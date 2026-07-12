import { PrismaClient, Contract, RentPayment, Transaction, Unit } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { differenceInDays, isLeapYear, getDaysInMonth, endOfMonth, isBefore, isAfter, max, min, startOfMonth, addDays } from "date-fns";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";
import * as documentService from "./document.service.js";
import { generateTenantStatementPdf } from "./utility-statement-pdf.service.js";
import { buildTenantCategoryLines } from "../lib/betrkv.js";

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
  public async calculateVacancyDeduction(
    propertyId: number,
    billingYear: number,
    totalFixedCosts: number,
    preloadedUnits?: { number: string; area: number; contracts: { startDate: Date; endDate: Date | null }[] }[]
  ) {
    const startOfYear = new Date(billingYear, 0, 1);
    const endOfYear = new Date(billingYear, 11, 31);

    const units = preloadedUnits ?? await prisma.unit.findMany({
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
    let vacantAreaDays = 0;
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
        current = addDays(current, 1);
      }

      if (unitVacancyDays > 0) affectedUnits.push(unit.number);
      totalVacancyDays += unitVacancyDays;
      vacantAreaDays += unitVacancyDays * unit.area;
    }

    if (totalVacancyDays === 0) return null;

    // Weight vacancy by area so that an empty parking spot doesn't deduct as
    // much as an empty apartment — costs are allocated to tenants by m², so
    // the owner's vacancy share must use the same key. Fallback to unit-day
    // weighting when no unit has an area (e.g. parking-only properties).
    const totalAreaDays = units.reduce((sum, u) => sum + u.area * daysInYear, 0);
    const vacancyRatio = totalAreaDays > 0
      ? vacantAreaDays / totalAreaDays
      : totalVacancyDays / (units.length * daysInYear);
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
   * Expense transactions of the property/year that are NOT yet marked
   * allocatable — shown in the wizard so the manager can pull them into the
   * statement without leaving the flow.
   */
  public async listUnallocatedTransactions(propertyId: number, year: number) {
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: this.companyId,
        propertyId,
        type: "AUSGABE",
        allocatable: false,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
      orderBy: { date: "asc" },
    });
    return transactions.map((tx) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
    }));
  }

  /** BetrKV categories that fall under the HeizkostenV consumption-split rules. */
  private static readonly HEATING_CATEGORIES = ["HEIZUNG", "WARMWASSER"];

  /** Share of heating costs allocated by metered consumption (§ 7 HeizkostenV: 50–70%). */
  private static readonly HEATING_CONSUMPTION_SHARE = 0.7;

  /**
   * Reads per-unit heating consumption for a billing year from WAERME/GAS
   * meters assigned to units. A meter contributes max(reading) - min(reading)
   * within the year (needs at least two readings).
   */
  private async getHeatingConsumptionByUnit(propertyId: number, year: number): Promise<Map<number, number>> {
    const meters = await prisma.meter.findMany({
      where: {
        propertyId,
        companyId: this.companyId,
        type: { in: ["WAERME", "GAS"] },
        unitId: { not: null },
      },
      include: {
        readings: {
          where: { readAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
        },
      },
    });

    const byUnit = new Map<number, number>();
    for (const meter of meters) {
      if (meter.unitId == null || meter.readings.length < 2) continue;
      const values = meter.readings.map((r) => r.value);
      const delta = Math.max(...values) - Math.min(...values);
      if (delta <= 0) continue;
      byUnit.set(meter.unitId, (byUnit.get(meter.unitId) ?? 0) + delta);
    }
    return byUnit;
  }

  /**
   * Composes pro-rata allocation, CO2-Stufenmodell, HeizkostenV heating split,
   * and Leerstands-Routing into a single per-contract statement for a
   * property/year. Recomputed live on every call — nothing here is persisted
   * as a "finalized" statement.
   */
  public async generateStatement(propertyId: number, year: number) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: this.companyId },
    });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const daysInYear = isLeapYear(startDate) ? 366 : 365;

    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: this.companyId,
        propertyId,
        type: "AUSGABE",
        allocatable: true,
        date: { gte: startDate, lt: endDate },
      },
    });

    const isHeatingTx = (tx: Transaction) =>
      tx.betrkvCategory != null && UtilityBillingService.HEATING_CATEGORIES.includes(tx.betrkvCategory);

    // CO2-Stufenmodell per transaction; landlord share is deducted from the
    // pool the transaction belongs to (heating vs. other).
    let heatingCo2Landlord = 0;
    let otherCo2Landlord = 0;
    let totalCo2TenantShare = 0;
    let landlordPercentage = 0;
    for (const tx of transactions) {
      if (tx.co2TaxAmount && tx.co2TaxAmount > 0) {
        const split = await this.applyCO2Stufenmodell(propertyId, tx.co2TaxAmount);
        if (isHeatingTx(tx)) heatingCo2Landlord += split.landlordShare;
        else otherCo2Landlord += split.landlordShare;
        totalCo2TenantShare += split.tenantShare;
        landlordPercentage = split.landlordPercentage;
      }
    }

    const passport = await prisma.energyPassport.findUnique({ where: { propertyId } });

    const grossCosts = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const heatingGross = transactions.filter(isHeatingTx).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const otherGross = grossCosts - heatingGross;
    const heatingPool = heatingGross - heatingCo2Landlord;
    const otherPool = otherGross - otherCo2Landlord;
    const totalCo2LandlordShare = heatingCo2Landlord + otherCo2Landlord;

    // HeizkostenV: split heating costs by metered consumption when possible.
    const consumptionByUnit =
      heatingPool > 0 ? await this.getHeatingConsumptionByUnit(propertyId, year) : new Map<number, number>();
    const totalConsumption = [...consumptionByUnit.values()].reduce((a, b) => a + b, 0);
    const consumptionBased = heatingPool > 0 && totalConsumption > 0;

    const allUnits = await prisma.unit.findMany({
      where: { propertyId, property: { companyId: this.companyId } },
      include: {
        contracts: {
          where: {
            startDate: { lte: new Date(year, 11, 31) },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
        },
      },
    });

    // Vacancy deduction applies to the area-allocated pool. In consumption
    // mode that's only the non-heating pool (the heating base-cost remainder
    // for vacant periods is routed to the owner separately below).
    const vacancyPool = consumptionBased ? otherPool : otherPool + heatingPool;
    const vacancyResult = await this.calculateVacancyDeduction(propertyId, year, vacancyPool, allUnits);
    const vacancyDeduction = vacancyResult?.amount ?? 0;
    const netAllocatable = vacancyPool - vacancyDeduction;

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
      vdiFraction: this.calculateHeatingBaseCostPercentage(year, contract.startDate, contract.endDate) / 100,
    }));
    const totalWeight = contractWeights.reduce(
      (sum, w) => sum + w.contract.unit.area * w.occupancyFraction,
      0
    );

    // Heating shares per contract (consumption mode only).
    const heatingByContract = new Map<number, number>();
    let heatingOwnerShare = 0;
    if (consumptionBased) {
      const basePool = heatingPool * (1 - UtilityBillingService.HEATING_CONSUMPTION_SHARE);
      const consPool = heatingPool * UtilityBillingService.HEATING_CONSUMPTION_SHARE;

      // Base costs: by area, VDI-2067-weighted over the occupancy period.
      // Denominator is the full property area so vacant periods stay with the owner.
      const totalArea = allUnits.reduce((sum, u) => sum + u.area, 0);

      // Consumption is metered per unit; when several contracts share a unit
      // within the year, split the unit's consumption by VDI weight.
      const vdiSumByUnit = new Map<number, number>();
      for (const w of contractWeights) {
        vdiSumByUnit.set(w.contract.unit.id, (vdiSumByUnit.get(w.contract.unit.id) ?? 0) + w.vdiFraction);
      }

      let allocated = 0;
      for (const w of contractWeights) {
        const baseShare = totalArea > 0 ? basePool * ((w.contract.unit.area * w.vdiFraction) / totalArea) : 0;
        const unitConsumption = consumptionByUnit.get(w.contract.unit.id) ?? 0;
        const unitVdiSum = vdiSumByUnit.get(w.contract.unit.id) ?? 0;
        const consShare =
          unitConsumption > 0 && unitVdiSum > 0
            ? consPool * (unitConsumption / totalConsumption) * (w.vdiFraction / unitVdiSum)
            : 0;
        const share = baseShare + consShare;
        heatingByContract.set(w.contract.id, share);
        allocated += share;
      }
      heatingOwnerShare = heatingPool - allocated;
    }

    const items = [];
    for (const { contract, occupancyFraction } of contractWeights) {
      const weight = contract.unit.area * occupancyFraction;
      const areaShare = totalWeight > 0 ? netAllocatable * (weight / totalWeight) : 0;
      const heatingShare = heatingByContract.get(contract.id) ?? 0;
      const share = areaShare + heatingShare;
      const balance = await this.calculateBalance(contract.id, year, share);
      items.push({
        contractId: contract.id,
        unitId: contract.unit.id,
        tenantId: contract.tenantId,
        unitNumber: contract.unit.number,
        tenantName: contract.tenant.name,
        area: contract.unit.area,
        occupancyDays: Math.round(occupancyFraction * daysInYear),
        amount: Math.round(share * 100) / 100,
        heatingAmount: Math.round(heatingShare * 100) / 100,
        totalPrepaid: Math.round(balance.totalPrepaid * 100) / 100,
        balance: Math.round(balance.balance * 100) / 100,
        isRefund: balance.isRefund,
      });
    }

    const totalArea = allUnits.reduce((sum, u) => sum + u.area, 0);

    return {
      year,
      propertyId,
      daysInYear,
      totalArea,
      totalCosts: Math.round(grossCosts * 100) / 100,
      co2: {
        energyClass: passport?.energyClass ?? null,
        co2Emissions: passport?.co2Emissions ?? null,
        landlordPercentage,
        tenantShare: Math.round(totalCo2TenantShare * 100) / 100,
        landlordShare: Math.round(totalCo2LandlordShare * 100) / 100,
      },
      heating:
        heatingGross > 0
          ? {
              totalCosts: Math.round(heatingGross * 100) / 100,
              consumptionBased,
              consumptionSharePercent: consumptionBased ? UtilityBillingService.HEATING_CONSUMPTION_SHARE * 100 : null,
              ownerShare: Math.round(heatingOwnerShare * 100) / 100,
              warning: consumptionBased
                ? undefined
                : "Heizkosten wurden mangels Verbrauchsdaten (Wärme-/Gaszähler pro Einheit) nach Wohnfläche verteilt. " +
                  "Die HeizkostenV verlangt eine überwiegend verbrauchsabhängige Abrechnung — Mieter haben sonst ein " +
                  "Kürzungsrecht von 15 % (§ 12 HeizkostenV).",
            }
          : null,
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

  /**
   * Turns a statement into durable artifacts: persists the owner-vacancy
   * ledger entry (idempotently — replaces any prior entry for this
   * property/year rather than duplicating it) and generates one PDF per
   * tenant, stored via document.service.ts. Re-running for the same
   * property/year replaces the previous documents instead of duplicating them.
   */
  public async finalizeStatement(propertyId: number, year: number) {
    const statement = await this.generateStatement(propertyId, year);

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    // Idempotent: always clear any prior run's vacancy entry first.
    await prisma.transaction.deleteMany({
      where: {
        propertyId,
        companyId: this.companyId,
        category: "Leerstands-Ausgleich",
        date: { gte: startOfYear, lte: endOfYear },
      },
    });

    if (statement.vacancy) {
      await prisma.transaction.create({
        data: {
          date: endOfYear,
          description: `Eigentümer-Abrechnung Leerstand ${year}`,
          type: "EINNAHME",
          amount: statement.vacancy.amount,
          category: "Leerstands-Ausgleich",
          allocatable: false,
          propertyId,
          companyId: this.companyId,
        },
      });
    }

    const company = await prisma.company.findUnique({ where: { id: this.companyId }, select: { name: true } });
    const property = await prisma.property.findFirst({ where: { id: propertyId, companyId: this.companyId } });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const safePropertyName = property.name.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
    const docName = `Nebenkostenabrechnung_${year}_${safePropertyName || propertyId}.pdf`;
    let generatedCount = 0;
    const itemsWithDocuments = [];

    for (const item of statement.items) {
      const existing = await prisma.document.findFirst({
        where: { tenantId: item.tenantId, companyId: this.companyId, name: docName },
      });
      if (existing) {
        await documentService.deleteDocument(this.companyId, existing.id);
      }

      const dir = path.join(env.UPLOAD_DIR, String(this.companyId), "tenants", String(item.tenantId));
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${crypto.randomUUID()}.pdf`);

      const categories = buildTenantCategoryLines(statement.transactions, item.amount, item.heatingAmount);

      const { filePath: generatedFilePath, fileSizeBytes } = await generateTenantStatementPdf(
        {
          companyName: company?.name ?? "",
          propertyName: property.name,
          tenantName: item.tenantName,
          unitNumber: item.unitNumber,
          year,
          amount: item.amount,
          balance: item.balance,
          isRefund: item.isRefund,
          totalPrepaid: item.totalPrepaid,
          area: item.area,
          totalArea: statement.totalArea,
          occupancyDays: item.occupancyDays,
          daysInYear: statement.daysInYear,
          totalCosts: statement.totalCosts,
          categories,
          co2: statement.co2.landlordShare > 0 ? statement.co2 : null,
          heating: statement.heating
            ? {
                consumptionBased: statement.heating.consumptionBased,
                consumptionSharePercent: statement.heating.consumptionSharePercent,
                warning: statement.heating.warning,
              }
            : null,
          vacancyDeduction: statement.vacancy?.amount ?? 0,
        },
        filePath
      );

      const document = await documentService.createDocument(this.companyId, {
        name: docName,
        fileType: "PDF",
        fileSize: `${(fileSizeBytes / 1024).toFixed(1)} KB`,
        filePath: generatedFilePath,
        tenantId: item.tenantId,
        propertyId,
      });
      itemsWithDocuments.push({ ...item, documentId: document?.id ?? null });
      generatedCount++;
    }

    return { propertyId, year, generatedCount, items: itemsWithDocuments };
  }
}
