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
   * Berechnet und erstellt eine Eigentümer-Rechnung für Leerstände,
   * damit leere Einheiten nicht von anderen Mietern subventioniert werden.
   */
  public async generateOwnerVacancyInvoice(propertyId: number, billingYear: number, totalFixedCosts: number) {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);
    
    // Finde alle Units der Property
    const units = await prisma.unit.findMany({
      where: { propertyId, property: { companyId: this.companyId } },
      include: {
        contracts: {
          where: {
            // Verträge, die ins Jahr fallen
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
    const daysInYear = isLeapYear(startOfYear) ? 366 : 365;

    // Für jede Unit schauen wir uns die vertragsfreien Tage an
    for (const unit of units) {
      // Vereinfachter Ansatz: Wir berechnen die Tage, in denen EIN Vertrag aktiv war
      let coveredDays = 0;
      // Normalerweise müssen wir Lücken zwischen Verträgen berechnen. 
      // Hier iterieren wir für MVP über jeden Tag des Jahres
      let current = new Date(startOfYear);
      let unitVacancyDays = 0;
      
      while (isBefore(current, endOfYear) || current.getTime() === endOfYear.getTime()) {
        const hasActiveContract = unit.contracts.some(c => 
          (isBefore(c.startDate, current) || c.startDate.getTime() === current.getTime()) &&
          (!c.endDate || isAfter(c.endDate, current) || c.endDate.getTime() === current.getTime())
        );

        if (!hasActiveContract) {
          unitVacancyDays++;
        }
        current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }
      
      totalVacancyDays += unitVacancyDays;
    }

    if (totalVacancyDays === 0) return null;

    // Kostenanteil für Leerstand: 
    // Hier vereinfacht als Durchschnitt auf alle Tage der Immobilie.
    // In der Realität müsste es anteilig nach Quadratmetern der leeren Units gehen.
    const totalUnitDays = units.length * daysInYear;
    const vacancyRatio = totalVacancyDays / totalUnitDays;
    const ownerCost = totalFixedCosts * vacancyRatio;

    // Erzeuge eine interne Transaktion zur Dokumentation
    return await prisma.transaction.create({
      data: {
        date: endOfYear,
        description: `Eigentümer-Abrechnung Leerstand ${billingYear}`,
        type: "EINNAHME", // Um die Ausgaben-Konten auszugleichen
        amount: ownerCost,
        category: "Leerstands-Ausgleich",
        allocatable: false,
        propertyId,
        companyId: this.companyId
      }
    });
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

    // TODO: The contract model currently doesn't explicitly store the utility prepayment amount.
    // For now, we assume a hypothetical field `utilityPrepayment` exists, 
    // or we calculate it based on custom logic if they separated it in RentPayment.
    // Let's assume we fetch all paid RentPayments in that year.
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

    // Summing up only the utility prepayment parts. 
    // As a placeholder before DB update, we assume `utilityPrepayment` on Contract.
    // Let's assume utilityPrepayment is a new field we will add or it's implicitly totalPaid - (monthlyRent * paidMonths)
    // We will update this later. For now, we mock the prepayment extraction.
    let totalPrepaid = 0;
    
    // Fallback: If no explicit utilityPrepayment, we cannot reliably extract it if partially paid.
    // For this implementation, we will query `amountPaid` and subtract `contract.monthlyRent`.
    // (This is a simplified assumption that underpayments first cover cold rent, or similar).
    
    // We will add utilityPrepayment to schema in the next step, so let's cast any here temporarily:
    const utilityPrepayment = (contract as any).utilityPrepayment || 0;
    
    for (const p of payments) {
      // If fully paid, the prepayment is fully received.
      if (p.amountPaid >= p.amountDue) {
        totalPrepaid += utilityPrepayment;
      } else {
        // Partial payment logic: assume rent is paid first, remainder is utility prepayment
        const remainder = p.amountPaid - contract.monthlyRent;
        if (remainder > 0) {
          totalPrepaid += Math.min(remainder, utilityPrepayment);
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
}
