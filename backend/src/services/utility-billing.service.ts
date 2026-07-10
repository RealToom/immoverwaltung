import { PrismaClient, Contract, RentPayment, Transaction, Unit } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { differenceInDays, isLeapYear, getDaysInMonth, endOfMonth, isBefore, isAfter, max, min, startOfMonth } from "date-fns";

/**
 * Utility Billing Service - Handles calculations according to German laws (BetrKV, HeizkostenV)
 */
export class UtilityBillingService {
  // Gradtagszahlen nach VDI 2067 (Promille-Werte)
  private readonly VDI_2067: Record<number, number> = {
    0: 170, // Jan
    1: 150, // Feb
    2: 130, // Mar
    3: 80,  // Apr
    4: 40,  // May
    5: 14,  // Jun
    6: 13,  // Jul
    7: 13,  // Aug
    8: 30,  // Sep
    9: 80,  // Oct
    10: 120, // Nov
    11: 160  // Dec
  };

  constructor(private readonly companyId: number) {}

  /**
   * Calculates the exact pro-rata share of fixed costs based on the days a tenant lived in the unit.
   * Formel: Anteilige Kosten = Gesamtkosten * (Wohntage / Gesamttage_des_Jahres)
   */
  public calculateProRataFixedCosts(
    totalCosts: number,
    billingYear: number,
    moveInDate: Date,
    moveOutDate: Date | null
  ): number {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);
    
    // Determine the actual period the tenant lived in the unit during the billing year
    const tenantStart = max([startOfYear, moveInDate]);
    const tenantEnd = min([endOfYear, moveOutDate || endOfYear]);

    if (isAfter(tenantStart, tenantEnd)) {
      return 0; // Tenant did not live in the unit during this year
    }

    const tenantDays = differenceInDays(tenantEnd, tenantStart) + 1;
    const daysInYear = isLeapYear(startOfYear) ? 366 : 365;

    return totalCosts * (tenantDays / daysInYear);
  }

  /**
   * Splits heating costs (Grundkosten) according to VDI 2067.
   * Returns the percentage (0-100) of the annual base heating cost the tenant has to pay.
   */
  public calculateHeatingBaseCostPercentage(
    billingYear: number,
    moveInDate: Date,
    moveOutDate: Date | null
  ): number {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);
    
    const tenantStart = max([startOfYear, moveInDate]);
    const tenantEnd = min([endOfYear, moveOutDate || endOfYear]);

    if (isAfter(tenantStart, tenantEnd)) {
      return 0;
    }

    let totalPromille = 0;

    let current = new Date(tenantStart);
    while (isBefore(current, tenantEnd) || current.getTime() === tenantEnd.getTime()) {
      const currentMonth = current.getMonth();
      const monthStart = startOfMonth(current);
      const monthEnd = endOfMonth(current);

      const overlapStart = max([monthStart, tenantStart]);
      const overlapEnd = min([monthEnd, tenantEnd]);
      
      const daysInCurrentMonth = getDaysInMonth(current);
      const daysInOverlap = differenceInDays(overlapEnd, overlapStart) + 1;

      // If full month, use full promille, otherwise proportional
      const promilleForMonth = this.VDI_2067[currentMonth];
      const actualPromille = promilleForMonth * (daysInOverlap / daysInCurrentMonth);
      
      totalPromille += actualPromille;

      // Move to next month
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return totalPromille / 10; // Convert per mille (Promille) to percentage
  }

  /**
   * CO2-Kostenaufteilungsgesetz (Stufenmodell).
   * Berechnet den Anteil, den der Vermieter übernehmen muss (0% bis 95%),
   * basierend auf dem EnergyPassport des Gebäudes.
   * Returns: Den anrechenbaren (vom Mieter zu zahlenden) CO2-Kosten-Betrag.
   */
  public async applyCO2Stufenmodell(
    propertyId: number,
    co2TaxTotal: number
  ): Promise<{ tenantShare: number; landlordShare: number; landlordPercentage: number }> {
    if (co2TaxTotal <= 0) return { tenantShare: 0, landlordShare: 0, landlordPercentage: 0 };

    const passport = await prisma.energyPassport.findUnique({
      where: { propertyId }
    });

    // Fallback: Wenn kein Ausweis da ist, pauschal 50% / 50% als gesetzliche Strafe/Ersatzwert
    if (!passport || !passport.co2Emissions) {
      return {
        tenantShare: co2TaxTotal * 0.5,
        landlordShare: co2TaxTotal * 0.5,
        landlordPercentage: 50
      };
    }

    const co2 = passport.co2Emissions;
    let landlordPercentage = 0;

    // Gesetzliche Stufen (vereinfacht für Wohngebäude ab 2023)
    if (co2 < 12) landlordPercentage = 0;
    else if (co2 < 17) landlordPercentage = 10;
    else if (co2 < 22) landlordPercentage = 20;
    else if (co2 < 27) landlordPercentage = 30;
    else if (co2 < 32) landlordPercentage = 40;
    else if (co2 < 37) landlordPercentage = 50;
    else if (co2 < 42) landlordPercentage = 60;
    else if (co2 < 47) landlordPercentage = 70;
    else if (co2 < 52) landlordPercentage = 80;
    else landlordPercentage = 95;

    const landlordShare = (co2TaxTotal * landlordPercentage) / 100;
    const tenantShare = co2TaxTotal - landlordShare;

    return { tenantShare, landlordShare, landlordPercentage };
  }

  /**
   * Computes the fixed-cost deduction owed by the property owner for unit
   * vacancy days, without persisting anything — used by generateStatement()'s
   * live recompute path. See generateOwnerVacancyInvoice() for the persisting
   * variant (reserved for an explicit future "finalize statement" action).
   */
  public async calculateVacancyDeduction(propertyId: number, billingYear: number, totalFixedCosts: number) {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);

    const units = await prisma.unit.findMany({
      where: { propertyId, property: { companyId: this.companyId } },
      include: {
        contracts: {
          where: {
            startDate: { lte: endOfYear },
            OR: [
              { endDate: null },
              { endDate: { gte: startOfYear } }
            ]
          }
        }
      }
    });

    let totalVacancyDays = 0;
    const affectedUnits: string[] = [];
    const daysInYear = isLeapYear(startOfYear) ? 366 : 365;

    for (const unit of units) {
      let unitVacancyDays = 0;
      let current = new Date(startOfYear);

      while (isBefore(current, endOfYear) || current.getTime() === endOfYear.getTime()) {
        const hasActiveContract = unit.contracts.some(c =>
          (isBefore(c.startDate, current) || c.startDate.getTime() === current.getTime()) &&
          (!c.endDate || isAfter(c.endDate, current) || c.endDate.getTime() === current.getTime())
        );
        if (!hasActiveContract) unitVacancyDays++;
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }

      if (unitVacancyDays > 0) affectedUnits.push(unit.number);
      totalVacancyDays += unitVacancyDays;
    }

    if (totalVacancyDays === 0) return null;

    const totalUnitDays = units.length * daysInYear;
    const vacancyRatio = totalVacancyDays / totalUnitDays;
    const amount = totalFixedCosts * vacancyRatio;

    return { amount, vacancyDays: totalVacancyDays, affectedUnits };
  }

  /**
   * Persisting variant: computes the same vacancy deduction, then creates an
   * internal Transaction so the property's ledger stays balanced. Reserved
   * for an explicit "finalize statement" action — do not call this from a
   * read/preview path (see calculateVacancyDeduction()).
   */
  public async generateOwnerVacancyInvoice(propertyId: number, billingYear: number, totalFixedCosts: number) {
    const deduction = await this.calculateVacancyDeduction(propertyId, billingYear, totalFixedCosts);
    if (!deduction) return null;

    const endOfYear = new Date(billingYear, 11, 31);
    const transaction = await prisma.transaction.create({
      data: {
        date: endOfYear,
        description: `Eigentümer-Abrechnung Leerstand ${billingYear}`,
        type: "EINNAHME",
        amount: deduction.amount,
        category: "Leerstands-Ausgleich",
        allocatable: false,
        propertyId,
        companyId: this.companyId
      }
    });

    return { transaction, vacancyDays: deduction.vacancyDays, affectedUnits: deduction.affectedUnits };
  }

  /**
   * Reconciles prepayments vs actual costs for a contract.
   * Assumes that the utility prepayment (Nebenkostenabschlag) is part of RentPayments.
   */
  public async calculateBalance(
    contractId: number,
    billingYear: number,
    totalAllocatedCosts: number
  ) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId }
    });

    if (!contract || contract.companyId !== this.companyId) {
      throw new AppError(404, "Vertrag nicht gefunden oder kein Zugriff");
    }

    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);

    const payments = await prisma.rentPayment.findMany({
      where: {
        contractId: contractId,
        companyId: this.companyId,
        month: {
          gte: startOfYear,
          lte: endOfYear
        },
        status: {
          in: ["PUENKTLICH", "VERSPAETET"]
        }
      }
    });

    let totalPrepaid = 0;
    for (const p of payments) {
      if (p.amountPaid >= p.amountDue) {
        totalPrepaid += contract.utilityPrepayment;
      } else {
        // Partial payment: assume rent is paid first, remainder is utility prepayment
        const remainder = p.amountPaid - contract.monthlyRent;
        if (remainder > 0) {
          totalPrepaid += Math.min(remainder, contract.utilityPrepayment);
        }
      }
    }

    const balance = totalPrepaid - totalAllocatedCosts;
    const isRefund = balance > 0;

    return {
      totalCosts: totalAllocatedCosts,
      totalPrepaid,
      balance,
      isRefund,
      isAdditionalPayment: !isRefund && balance < 0
    };
  }

  /**
   * Composes pro-rata allocation, CO2-Stufenmodell, and Leerstands-Routing into
   * a single per-contract statement for a property/year. Recomputed live on every
   * call — nothing here is persisted as a "finalized" statement.
   */
  public async generateStatement(propertyId: number, year: number) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: this.companyId },
    });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: this.companyId,
        propertyId,
        type: "AUSGABE",
        allocatable: true,
        date: { gte: startDate, lt: endDate },
      },
    });

    let totalCo2LandlordShare = 0;
    let totalCo2TenantShare = 0;
    let landlordPercentage = 0;
    for (const tx of transactions) {
      if (tx.co2TaxAmount && tx.co2TaxAmount > 0) {
        const split = await this.applyCO2Stufenmodell(propertyId, tx.co2TaxAmount);
        totalCo2LandlordShare += split.landlordShare;
        totalCo2TenantShare += split.tenantShare;
        landlordPercentage = split.landlordPercentage;
      }
    }

    const passport = await prisma.energyPassport.findUnique({ where: { propertyId } });

    const grossCosts = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalAllocatable = grossCosts - totalCo2LandlordShare;

    const vacancyResult = await this.calculateVacancyDeduction(propertyId, year, totalAllocatable);
    const vacancyDeduction = vacancyResult?.amount ?? 0;
    const netAllocatable = totalAllocatable - vacancyDeduction;

    const contracts = await prisma.contract.findMany({
      where: {
        propertyId,
        companyId: this.companyId,
        startDate: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
      include: {
        unit: { select: { id: true, number: true, area: true } },
        tenant: { select: { id: true, name: true } },
      },
    });

    const contractWeights = contracts.map((contract) => ({
      contract,
      occupancyFraction: this.calculateProRataFixedCosts(1, year, contract.startDate, contract.endDate),
    }));
    const totalWeight = contractWeights.reduce(
      (sum, w) => sum + w.contract.unit.area * w.occupancyFraction,
      0
    );

    const items = [];
    for (const { contract, occupancyFraction } of contractWeights) {
      const weight = contract.unit.area * occupancyFraction;
      const share = totalWeight > 0 ? netAllocatable * (weight / totalWeight) : 0;
      const balance = await this.calculateBalance(contract.id, year, share);
      items.push({
        contractId: contract.id,
        unitId: contract.unit.id,
        unitNumber: contract.unit.number,
        tenantName: contract.tenant.name,
        area: contract.unit.area,
        amount: Math.round(share * 100) / 100,
        balance: Math.round(balance.balance * 100) / 100,
        isRefund: balance.isRefund,
      });
    }

    return {
      year,
      propertyId,
      totalCosts: Math.round(grossCosts * 100) / 100,
      co2: {
        energyClass: passport?.energyClass ?? null,
        co2Emissions: passport?.co2Emissions ?? null,
        landlordPercentage,
        tenantShare: Math.round(totalCo2TenantShare * 100) / 100,
        landlordShare: Math.round(totalCo2LandlordShare * 100) / 100,
      },
      vacancy: vacancyResult
        ? {
            amount: Math.round(vacancyDeduction * 100) / 100,
            vacancyDays: vacancyResult.vacancyDays,
            affectedUnits: vacancyResult.affectedUnits,
          }
        : null,
      items,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        betrkvCategory: tx.betrkvCategory,
        maintenanceWarning: tx.maintenanceWarning,
        co2TaxAmount: tx.co2TaxAmount,
      })),
    };
  }
}
