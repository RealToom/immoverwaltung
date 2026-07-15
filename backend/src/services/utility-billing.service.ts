import { PrismaClient, Contract, RentPayment, Transaction, Unit, MeterType } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { differenceInDays, isLeapYear, getDaysInMonth, endOfMonth, isBefore, isAfter, max, min, startOfMonth, addDays } from "date-fns";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";
import * as documentService from "./document.service.js";
import { generateTenantStatementPdf } from "./utility-statement-pdf.service.js";
import { sendUtilityStatementEmail } from "./email.service.js";
import { buildTenantCategoryLines } from "../lib/betrkv.js";
import { logger } from "../lib/logger.js";

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
    return totalCosts * this.proRataFraction(new Date(billingYear, 0, 1), new Date(billingYear, 11, 31), moveInDate, moveOutDate);
  }

  /** Resolves a billing period from its start month (§ abweichendes Wirtschaftsjahr). */
  private resolvePeriod(year: number, startMonth: number | null | undefined) {
    const m = Math.min(Math.max(startMonth || 1, 1), 12) - 1;
    const periodStart = new Date(year, m, 1);
    const periodEnd = addDays(new Date(year + 1, m, 1), -1);
    const daysInPeriod = differenceInDays(periodEnd, periodStart) + 1;
    return { periodStart, periodEnd, daysInPeriod };
  }

  /** Fraction (0..1) of a billing period a tenant occupied the unit. */
  private proRataFraction(periodStart: Date, periodEnd: Date, moveInDate: Date, moveOutDate: Date | null): number {
    const tenantStart = max([periodStart, moveInDate]);
    const tenantEnd = min([periodEnd, moveOutDate || periodEnd]);
    if (isAfter(tenantStart, tenantEnd)) return 0;
    const tenantDays = differenceInDays(tenantEnd, tenantStart) + 1;
    const periodDays = differenceInDays(periodEnd, periodStart) + 1;
    return tenantDays / periodDays;
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
    return this.heatingBaseFraction(new Date(billingYear, 0, 1), new Date(billingYear, 11, 31), moveInDate, moveOutDate) * 100;
  }

  /** VDI-2067-weighted fraction (0..1) of the heating base cost for a period. */
  private heatingBaseFraction(periodStart: Date, periodEnd: Date, moveInDate: Date, moveOutDate: Date | null): number {
    const tenantStart = max([periodStart, moveInDate]);
    const tenantEnd = min([periodEnd, moveOutDate || periodEnd]);
    if (isAfter(tenantStart, tenantEnd)) return 0;

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

      totalPromille += this.VDI_2067[currentMonth] * (daysInOverlap / daysInCurrentMonth);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return totalPromille / 1000; // per mille → fraction
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
  ): Promise<{ tenantShare: number; landlordShare: number; landlordPercentage: number; dataMissing: boolean }> {
    if (co2TaxTotal <= 0) return { tenantShare: 0, landlordShare: 0, landlordPercentage: 0, dataMissing: false };

    const passport = await prisma.energyPassport.findUnique({
      where: { propertyId }
    });

    // Vorläufiger Fallback ohne CO2-Emissionsdaten: 50/50. ACHTUNG — das ist KEINE
    // gesetzliche Regel für Wohngebäude, sondern nur die Übergangsregel für
    // Nichtwohngebäude (§ 8 CO2KostAufG). Für Wohngebäude ist zwingend das
    // Stufenmodell (§ 5) anzuwenden; die CO2-Emissionen pro m²/Jahr müssen aus dem
    // Energieausweis bzw. der Brennstoffrechnung (§ 3 CO2KostAufG) stammen. Der
    // 50/50-Wert dient nur, damit die Abrechnung nicht blockiert — der Aufrufer
    // MUSS über `dataMissing` einen Warnhinweis ausgeben.
    if (!passport || !passport.co2Emissions) {
      return {
        tenantShare: co2TaxTotal * 0.5,
        landlordShare: co2TaxTotal * 0.5,
        landlordPercentage: 50,
        dataMissing: true
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

    return { tenantShare, landlordShare, landlordPercentage, dataMissing: false };
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
    preloadedUnits?: { number: string; area: number; contracts: { startDate: Date; endDate: Date | null }[] }[],
    period?: { periodStart: Date; periodEnd: Date; daysInPeriod: number }
  ) {
    const startOfYear = period?.periodStart ?? new Date(billingYear, 0, 1);
    const endOfYear = period?.periodEnd ?? new Date(billingYear, 11, 31);
    const daysInYear = period?.daysInPeriod ?? (isLeapYear(startOfYear) ? 366 : 365);

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

  /** Meter types used per heating pool (§ 9 HeizkostenV: Warmwasser separat erfassen). */
  private static readonly HEATING_POOLS: { category: string; label: string; meterTypes: MeterType[] }[] = [
    { category: "HEIZUNG", label: "Heizung", meterTypes: ["WAERME", "GAS"] },
    { category: "WARMWASSER", label: "Warmwasser", meterTypes: ["WARMWASSER"] },
  ];

  /**
   * Verbrauchsabhängiger Anteil der Heiz-/Warmwasserkosten (§ 7 Abs. 1 HeizkostenV).
   * Zulässig sind 50–70 %; 70 % ist die verbrauchsstärkste Variante und für Gebäude
   * mit überwiegend gedämmten Leitungen bzw. bestimmte Neubauten sogar vorgeschrieben,
   * für alle anderen frei wählbar. 70 % ist daher der sichere Standard. Wenn dies
   * je Objekt konfigurierbar werden soll, ist ein Feld am Property + Migration nötig.
   */
  private static readonly HEATING_CONSUMPTION_SHARE = 0.7;

  /**
   * Reads per-unit consumption for a billing year from meters of the given
   * types assigned to units. A meter contributes max(reading) - min(reading)
   * within the year (needs at least two readings).
   */
  private async getConsumptionByUnit(
    propertyId: number,
    periodStart: Date,
    periodEndExclusive: Date,
    meterTypes: MeterType[]
  ): Promise<Map<number, number>> {
    const meters = await prisma.meter.findMany({
      where: {
        propertyId,
        companyId: this.companyId,
        type: { in: meterTypes },
        unitId: { not: null },
      },
      include: {
        readings: {
          where: { readAt: { gte: periodStart, lt: periodEndExclusive } },
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
   * Allocates a single heating pool (Heizung or Warmwasser) 70% by metered
   * consumption / 30% as base cost by area (VDI-2067-weighted over the
   * occupancy period). Consumption metered per unit is split by VDI weight
   * when several contracts share a unit within the year (§ 9b Schätzung).
   * Returns per-contract shares, the owner's (vacancy) remainder, and whether
   * any unit's consumption had to be estimated across a tenant change.
   */
  private allocateHeatingPool(
    pool: number,
    consumptionByUnit: Map<number, number>,
    contractWeights: { contract: { id: number; unit: { id: number; area: number } }; vdiFraction: number }[],
    totalArea: number
  ): { byContract: Map<number, number>; ownerShare: number; estimated: boolean } {
    const byContract = new Map<number, number>();
    const totalConsumption = [...consumptionByUnit.values()].reduce((a, b) => a + b, 0);
    if (totalConsumption <= 0) return { byContract, ownerShare: 0, estimated: false };

    const basePool = pool * (1 - UtilityBillingService.HEATING_CONSUMPTION_SHARE);
    const consPool = pool * UtilityBillingService.HEATING_CONSUMPTION_SHARE;

    const vdiSumByUnit = new Map<number, number>();
    const contractsPerUnit = new Map<number, number>();
    for (const w of contractWeights) {
      vdiSumByUnit.set(w.contract.unit.id, (vdiSumByUnit.get(w.contract.unit.id) ?? 0) + w.vdiFraction);
      contractsPerUnit.set(w.contract.unit.id, (contractsPerUnit.get(w.contract.unit.id) ?? 0) + 1);
    }

    let allocated = 0;
    let estimated = false;
    for (const w of contractWeights) {
      const baseShare = totalArea > 0 ? basePool * ((w.contract.unit.area * w.vdiFraction) / totalArea) : 0;
      const unitConsumption = consumptionByUnit.get(w.contract.unit.id) ?? 0;
      const unitVdiSum = vdiSumByUnit.get(w.contract.unit.id) ?? 0;
      const consShare =
        unitConsumption > 0 && unitVdiSum > 0
          ? consPool * (unitConsumption / totalConsumption) * (w.vdiFraction / unitVdiSum)
          : 0;
      // § 9b: a metered unit shared by more than one contract in the year had
      // its consumption apportioned by VDI weight — that portion is estimated.
      if (unitConsumption > 0 && (contractsPerUnit.get(w.contract.unit.id) ?? 0) > 1) estimated = true;
      const share = baseShare + consShare;
      byContract.set(w.contract.id, (byContract.get(w.contract.id) ?? 0) + share);
      allocated += share;
    }
    return { byContract, ownerShare: pool - allocated, estimated };
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

    // Abrechnungszeitraum kann vom Kalenderjahr abweichen (Property.billingPeriodStartMonth).
    const { periodStart, periodEnd, daysInPeriod } = this.resolvePeriod(
      year,
      (property as { billingPeriodStartMonth?: number }).billingPeriodStartMonth
    );
    const startDate = periodStart;
    const endDate = addDays(periodEnd, 1); // exclusive upper bound
    const daysInYear = daysInPeriod;

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
    // pool the transaction belongs to (Heizung / Warmwasser / sonstige).
    const poolKeyOf = (tx: Transaction) =>
      tx.betrkvCategory === "HEIZUNG" ? "HEIZUNG" : tx.betrkvCategory === "WARMWASSER" ? "WARMWASSER" : "OTHER";
    const co2LandlordByPool: Record<string, number> = { HEIZUNG: 0, WARMWASSER: 0, OTHER: 0 };
    let totalCo2TenantShare = 0;
    let landlordPercentage = 0;
    let co2DataMissing = false;
    for (const tx of transactions) {
      if (tx.co2TaxAmount && tx.co2TaxAmount > 0) {
        const split = await this.applyCO2Stufenmodell(propertyId, tx.co2TaxAmount);
        co2LandlordByPool[poolKeyOf(tx)] += split.landlordShare;
        totalCo2TenantShare += split.tenantShare;
        landlordPercentage = split.landlordPercentage;
        if (split.dataMissing) co2DataMissing = true;
      }
    }

    const passport = await prisma.energyPassport.findUnique({ where: { propertyId } });

    // Verteilerschlüssel je BetrKV-Kategorie (§ 556a: WOHNFLAECHE als
    // gesetzlicher Standard, PERSONEN oder WOHNEINHEIT per Konfiguration).
    const config = (property.costConfiguration ?? {}) as Record<string, string>;
    const keyFor = (cat: string | null) => (cat && config[cat]) || "WOHNFLAECHE";

    const grossCosts = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const heatingGross = transactions.filter(isHeatingTx).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const otherGross = grossCosts - heatingGross;
    const nonHeating = transactions.filter((tx) => !isHeatingTx(tx));
    const personGross = nonHeating
      .filter((tx) => keyFor(tx.betrkvCategory) === "PERSONEN")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const unitGross = nonHeating
      .filter((tx) => keyFor(tx.betrkvCategory) === "WOHNEINHEIT")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    // Only the WOHNFLAECHE-keyed remainder flows through the area pool (and
    // absorbs vacancy). Person-/unit-keyed costs are allocated in full to the
    // occupying tenants below.
    const otherPool = otherGross - personGross - unitGross - co2LandlordByPool.OTHER;
    const totalCo2LandlordShare =
      co2LandlordByPool.HEIZUNG + co2LandlordByPool.WARMWASSER + co2LandlordByPool.OTHER;

    const distributionKeys: Record<string, string> = {};
    for (const tx of nonHeating) {
      if (tx.betrkvCategory) distributionKeys[tx.betrkvCategory] = keyFor(tx.betrkvCategory);
    }

    const allUnits = await prisma.unit.findMany({
      where: { propertyId, property: { companyId: this.companyId } },
      include: {
        contracts: {
          where: {
            startDate: { lte: periodEnd },
            OR: [{ endDate: null }, { endDate: { gte: startDate } }],
          },
        },
      },
    });
    const totalArea = allUnits.reduce((sum, u) => sum + u.area, 0);

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
      occupancyFraction: this.proRataFraction(periodStart, periodEnd, contract.startDate, contract.endDate),
      vdiFraction: this.heatingBaseFraction(periodStart, periodEnd, contract.startDate, contract.endDate),
    }));
    const totalWeight = contractWeights.reduce(
      (sum, w) => sum + w.contract.unit.area * w.occupancyFraction,
      0
    );
    // Denominators for the alternative distribution keys (occupancy-weighted).
    const personWeightTotal =
      personGross > 0
        ? contractWeights.reduce((sum, w) => sum + (w.contract.occupantsCount ?? 1) * w.occupancyFraction, 0)
        : 0;
    const unitWeightTotal =
      unitGross > 0 ? contractWeights.reduce((sum, w) => sum + w.occupancyFraction, 0) : 0;

    // HeizkostenV: each heating pool (Heizung, Warmwasser) is split 70/30 by
    // its own metered consumption (§ 9 verlangt getrennte Warmwassererfassung).
    // Pools without usable meter data fall back into the area-allocated pool
    // and raise the § 12 Kürzungsrecht warning.
    const heatingByContract = new Map<number, number>();
    let heatingOwnerShare = 0;
    let heatingAreaFallbackPool = 0;
    let anyEstimated = false;
    let anyFallbackToArea = false;
    let anyConsumption = false;
    const poolDetail: Record<string, { totalCosts: number; consumptionBased: boolean; ownerShare: number }> = {};

    for (const def of UtilityBillingService.HEATING_POOLS) {
      const gross = transactions
        .filter((tx) => tx.betrkvCategory === def.category)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      if (gross <= 0) continue;
      const pool = gross - (co2LandlordByPool[def.category] ?? 0);
      const consumptionByUnit = await this.getConsumptionByUnit(propertyId, periodStart, endDate, def.meterTypes);
      const totalConsumption = [...consumptionByUnit.values()].reduce((a, b) => a + b, 0);

      if (totalConsumption > 0) {
        const { byContract, ownerShare, estimated } = this.allocateHeatingPool(
          pool,
          consumptionByUnit,
          contractWeights,
          totalArea
        );
        for (const [cid, share] of byContract) {
          heatingByContract.set(cid, (heatingByContract.get(cid) ?? 0) + share);
        }
        heatingOwnerShare += ownerShare;
        anyEstimated = anyEstimated || estimated;
        anyConsumption = true;
        poolDetail[def.category] = { totalCosts: gross, consumptionBased: true, ownerShare };
      } else {
        heatingAreaFallbackPool += pool;
        anyFallbackToArea = true;
        poolDetail[def.category] = { totalCosts: gross, consumptionBased: false, ownerShare: 0 };
      }
    }

    // Vacancy deduction applies to the area-allocated pool: the non-heating
    // costs plus any heating pool that had to fall back to area allocation.
    const vacancyPool = otherPool + heatingAreaFallbackPool;
    const vacancyResult = await this.calculateVacancyDeduction(propertyId, year, vacancyPool, allUnits, {
      periodStart,
      periodEnd,
      daysInPeriod,
    });
    const vacancyDeduction = vacancyResult?.amount ?? 0;
    const netAllocatable = vacancyPool - vacancyDeduction;

    const items = [];
    for (const { contract, occupancyFraction } of contractWeights) {
      const weight = contract.unit.area * occupancyFraction;
      const areaShare = totalWeight > 0 ? netAllocatable * (weight / totalWeight) : 0;
      const heatingShare = heatingByContract.get(contract.id) ?? 0;
      const personShare =
        personGross > 0 && personWeightTotal > 0
          ? personGross * (((contract.occupantsCount ?? 1) * occupancyFraction) / personWeightTotal)
          : 0;
      const unitShare = unitGross > 0 && unitWeightTotal > 0 ? unitGross * (occupancyFraction / unitWeightTotal) : 0;
      const share = areaShare + heatingShare + personShare + unitShare;
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
        // § 560 Abs. 4 BGB: angemessene neue Vorauszahlung = 1/12 des Kostenanteils.
        suggestedPrepayment: Math.round((share / 12) * 100) / 100,
        // § 35a EStG deductible labor share (filled in below).
        laborCostShare: 0,
      });
    }

    // § 35a EStG: certify each tenant's proportional share of the labor
    // (Lohn-)costs contained in the allocatable expenses (20% deductible).
    const totalLaborCosts = transactions.reduce((sum, tx) => sum + (tx.laborCostAmount ?? 0), 0);
    const allocatedTotal = items.reduce((sum, i) => sum + i.amount, 0);
    if (totalLaborCosts > 0 && allocatedTotal > 0) {
      for (const item of items) {
        item.laborCostShare = Math.round(totalLaborCosts * (item.amount / allocatedTotal) * 100) / 100;
      }
    }

    // § 556a BGB Vorwegabzug: commercial (GEWERBE) units carry their own
    // proportional share; residential tenants are not burdened by commercial
    // cost drivers. The area/consumption distribution already assigns each
    // commercial contract its share — this surfaces the deducted amount.
    const commercialIds = new Set(
      contracts.filter((c) => c.type === "GEWERBE").map((c) => c.id)
    );
    const commercialItems = items.filter((i) => commercialIds.has(i.contractId));
    const commercialCosts = commercialItems.reduce((sum, i) => sum + i.amount, 0);
    const vorwegabzug =
      commercialItems.length > 0
        ? {
            commercialUnits: commercialItems.map((i) => i.unitNumber),
            commercialCosts: Math.round(commercialCosts * 100) / 100,
            sharePercent:
              grossCosts > 0 ? Math.round((commercialCosts / grossCosts) * 1000) / 10 : 0,
            note:
              "§ 556a BGB: Die auf Gewerbeeinheiten entfallenden Betriebskosten wurden nach Fläche/Verbrauch " +
              "vorweg abgezogen und den gewerblichen Nutzern direkt zugeordnet. Wohnraummieter tragen nur den Wohnanteil.",
          }
        : null;

    return {
      year,
      propertyId,
      periodStart,
      periodEnd,
      daysInYear,
      totalArea,
      totalCosts: Math.round(grossCosts * 100) / 100,
      totalLaborCosts: Math.round(totalLaborCosts * 100) / 100,
      distributionKeys,
      vorwegabzug,
      co2: {
        energyClass: passport?.energyClass ?? null,
        co2Emissions: passport?.co2Emissions ?? null,
        landlordPercentage,
        tenantShare: Math.round(totalCo2TenantShare * 100) / 100,
        landlordShare: Math.round(totalCo2LandlordShare * 100) / 100,
        warning: co2DataMissing
          ? "Für dieses Gebäude sind keine CO₂-Emissionsdaten hinterlegt (Energieausweis bzw. Ausweisung " +
            "auf der Brennstoffrechnung gem. § 3 CO2KostAufG). Die CO₂-Kosten wurden vorläufig 50/50 geteilt. " +
            "Für Wohngebäude ist jedoch das Stufenmodell (§ 5 CO2KostAufG) verbindlich — bitte die CO₂-Emissionen " +
            "pro m²/Jahr hinterlegen, damit der Vermieteranteil korrekt (0–95 %) berechnet wird."
          : undefined,
      },
      heating:
        heatingGross > 0
          ? {
              totalCosts: Math.round(heatingGross * 100) / 100,
              consumptionBased: anyConsumption && !anyFallbackToArea,
              consumptionSharePercent: anyConsumption ? UtilityBillingService.HEATING_CONSUMPTION_SHARE * 100 : null,
              ownerShare: Math.round(heatingOwnerShare * 100) / 100,
              warning: anyFallbackToArea
                ? "Heizkosten wurden mangels Verbrauchsdaten (Wärme-/Gas-/Warmwasserzähler pro Einheit) nach Wohnfläche verteilt. " +
                  "Die HeizkostenV verlangt eine überwiegend verbrauchsabhängige Abrechnung — Mieter haben sonst ein " +
                  "Kürzungsrecht von 15 % (§ 12 HeizkostenV)."
                : undefined,
              estimated: anyEstimated,
              estimationNotice: anyEstimated
                ? "Bei unterjährigem Nutzerwechsel wurde der gemessene Verbrauch mangels Zwischenablesung nach " +
                  "Gradtagstabelle (VDI 2067) geschätzt (§ 9b HeizkostenV)."
                : undefined,
              warmWater: poolDetail.WARMWASSER
                ? {
                    totalCosts: Math.round(poolDetail.WARMWASSER.totalCosts * 100) / 100,
                    consumptionBased: poolDetail.WARMWASSER.consumptionBased,
                    ownerShare: Math.round(poolDetail.WARMWASSER.ownerShare * 100) / 100,
                  }
                : null,
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

    // Abrechnungszeitraum (ggf. abweichend vom Kalenderjahr) aus dem Statement.
    const startOfYear = statement.periodStart;
    const endOfYear = statement.periodEnd;

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
          periodStart: statement.periodStart,
          periodEnd: statement.periodEnd,
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
          distributionKeys: statement.distributionKeys,
          // Show the § 556a note to residential tenants (not to the commercial
          // unit itself, which is the one whose share was deducted vorweg).
          vorwegabzugNote:
            statement.vorwegabzug && !statement.vorwegabzug.commercialUnits.includes(item.unitNumber)
              ? statement.vorwegabzug.note
              : null,
          co2: statement.co2.landlordShare > 0 ? statement.co2 : null,
          heating: statement.heating
            ? {
                consumptionBased: statement.heating.consumptionBased,
                consumptionSharePercent: statement.heating.consumptionSharePercent,
                warning: statement.heating.warning,
                estimationNotice: statement.heating.estimationNotice,
              }
            : null,
          vacancyDeduction: statement.vacancy?.amount ?? 0,
          laborCostShare: item.laborCostShare,
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

    // Persist an immutable snapshot: the numbers the tenants received must
    // never drift when transactions change later. Re-finalizing supersedes
    // the previous snapshot (Korrekturabrechnung) instead of mutating it.
    const statementRecord = await prisma.utilityStatement.create({
      data: {
        propertyId,
        companyId: this.companyId,
        year,
        periodStart: startOfYear,
        periodEnd: endOfYear,
        // § 556 Abs. 3 BGB: Zugang beim Mieter binnen 12 Monaten nach Periodenende
        deliveryDeadline: new Date(endOfYear.getFullYear() + 1, endOfYear.getMonth(), endOfYear.getDate()),
        totalCosts: statement.totalCosts,
        data: statement as unknown as object,
        items: {
          create: itemsWithDocuments.map((item) => ({
            companyId: this.companyId,
            contractId: item.contractId,
            tenantId: item.tenantId,
            unitId: item.unitId,
            tenantName: item.tenantName,
            unitNumber: item.unitNumber,
            amount: item.amount,
            heatingAmount: item.heatingAmount,
            totalPrepaid: item.totalPrepaid,
            balance: item.balance,
            isRefund: item.isRefund,
            documentId: item.documentId,
            // § 560 Abs. 4 BGB: angemessene neue Vorauszahlung = 1/12 des Kostenanteils
            suggestedPrepayment: Math.round((item.amount / 12) * 100) / 100,
          })),
        },
      },
      include: { items: { select: { id: true, contractId: true, settlementStatus: true } } },
    });

    // Link each result item to its persisted snapshot item so the admin UI can
    // manage payment settlement (Nachzahlung/Guthaben) per tenant.
    const itemIdByContract = new Map<number, { id: number; settlementStatus: string }>(
      (statementRecord.items ?? []).map((it) => [it.contractId, { id: it.id, settlementStatus: it.settlementStatus }])
    );

    await prisma.utilityStatement.updateMany({
      where: { propertyId, companyId: this.companyId, year, status: "FINALISIERT", id: { not: statementRecord.id } },
      data: { status: "KORRIGIERT", supersededById: statementRecord.id },
    });

    // § 556 Zustellung: Mieter mit Portal-Konto elektronisch benachrichtigen und
    // den Zustellzeitpunkt auf dem Snapshot-Item festhalten (Fristnachweis).
    for (const item of itemsWithDocuments) {
      const tenantUser = await prisma.tenantUser.findFirst({
        where: { tenantId: item.tenantId, companyId: this.companyId },
        select: { email: true },
      });
      if (!tenantUser) continue;

      await sendUtilityStatementEmail(this.companyId, {
        to: tenantUser.email,
        tenantName: item.tenantName,
        propertyName: property.name,
        year,
        balance: item.balance,
        isRefund: item.isRefund,
      }).catch((err) => logger.error({ err }, "Zustellung der Nebenkostenabrechnung per E-Mail fehlgeschlagen"));

      await prisma.utilityStatementItem.updateMany({
        where: { statementId: statementRecord.id, tenantId: item.tenantId },
        data: { deliveredAt: new Date() },
      });
    }

    const resultItems = itemsWithDocuments.map((item) => {
      const link = itemIdByContract.get(item.contractId);
      return {
        ...item,
        statementItemId: link?.id ?? null,
        settlementStatus: link?.settlementStatus ?? "OFFEN",
      };
    });

    return { propertyId, year, generatedCount, statementId: statementRecord.id, items: resultItems };
  }

  /**
   * § 556 Abs. 3 BGB Fristverfolgung: für jede Immobilie der letzten beiden
   * Abrechnungsjahre die noch nicht finalisierten Perioden mit anfallenden
   * Kosten, inkl. Zustellfrist (Periodenende + 12 Monate) und Resttagen.
   */
  public async getStatementDeadlines() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const candidateYears = [currentYear - 2, currentYear - 1];

    const [properties, finalized, costTx] = await Promise.all([
      prisma.property.findMany({
        where: { companyId: this.companyId },
        select: { id: true, name: true },
      }),
      prisma.utilityStatement.findMany({
        where: { companyId: this.companyId, status: "FINALISIERT" },
        select: { propertyId: true, year: true },
      }),
      prisma.transaction.findMany({
        where: {
          companyId: this.companyId,
          type: "AUSGABE",
          allocatable: true,
          date: { gte: new Date(candidateYears[0], 0, 1), lt: new Date(currentYear, 0, 1) },
        },
        select: { propertyId: true, date: true },
      }),
    ]);

    const finalizedSet = new Set(finalized.map((s) => `${s.propertyId}-${s.year}`));
    const costSet = new Set(costTx.map((t) => `${t.propertyId}-${t.date.getFullYear()}`));

    const deadlines: {
      propertyId: number;
      propertyName: string;
      year: number;
      deadline: Date;
      daysRemaining: number;
      overdue: boolean;
    }[] = [];

    for (const property of properties) {
      for (const year of candidateYears) {
        const key = `${property.id}-${year}`;
        if (finalizedSet.has(key) || !costSet.has(key)) continue;
        const deadline = new Date(year + 1, 11, 31);
        const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
        deadlines.push({
          propertyId: property.id,
          propertyName: property.name,
          year,
          deadline,
          daysRemaining,
          overdue: daysRemaining < 0,
        });
      }
    }

    return deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * Persists the per-category distribution keys (Verteilerschlüssel) for a
   * property. Format: { GRUNDSTEUER: "WOHNFLAECHE", HAUSWART: "WOHNEINHEIT" }.
   */
  public async setDistributionKeys(propertyId: number, costConfiguration: Record<string, string>) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: this.companyId },
    });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");
    return prisma.property.update({
      where: { id: propertyId },
      data: { costConfiguration },
      select: { id: true, costConfiguration: true },
    });
  }

  /**
   * § 560 Abs. 4 BGB: applies an adjusted monthly utility prepayment to a
   * contract (one-click from the wizard's suggested value).
   */
  public async applyPrepaymentAdjustment(contractId: number, utilityPrepayment: number) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, companyId: this.companyId },
    });
    if (!contract) throw new AppError(404, "Vertrag nicht gefunden");
    return prisma.contract.update({
      where: { id: contractId },
      data: { utilityPrepayment },
      select: { id: true, utilityPrepayment: true },
    });
  }

  /**
   * Payment settlement of a statement item (Nachzahlung/Guthaben): mark it
   * BEZAHLT/VERRECHNET (stamps settledAt) or reset to OFFEN.
   */
  public async updateSettlementStatus(
    itemId: number,
    settlementStatus: "OFFEN" | "BEZAHLT" | "VERRECHNET"
  ) {
    const item = await prisma.utilityStatementItem.findFirst({
      where: { id: itemId, companyId: this.companyId },
    });
    if (!item) throw new AppError(404, "Abrechnungsposten nicht gefunden");
    return prisma.utilityStatementItem.update({
      where: { id: itemId },
      data: { settlementStatus, settledAt: settlementStatus === "OFFEN" ? null : new Date() },
      select: { id: true, settlementStatus: true, settledAt: true },
    });
  }

  /**
   * Plausibility checks for the wizard: flags allocatable cost categories that
   * changed by more than 25% against the previous billing period, and reports
   * the property's operating cost per m² and month against a benchmark band
   * (Betriebskostenspiegel ≈ 1,50–3,00 €/m²/Monat).
   */
  public async runPlausibilityChecks(propertyId: number, year: number) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: this.companyId },
    });
    if (!property) throw new AppError(404, "Immobilie nicht gefunden");

    const startMonth = (property as { billingPeriodStartMonth?: number }).billingPeriodStartMonth;
    const sumByCategory = async (y: number) => {
      const { periodStart, periodEnd } = this.resolvePeriod(y, startMonth);
      const txs = await prisma.transaction.findMany({
        where: {
          companyId: this.companyId,
          propertyId,
          type: "AUSGABE",
          allocatable: true,
          date: { gte: periodStart, lt: addDays(periodEnd, 1) },
        },
        select: { amount: true, betrkvCategory: true },
      });
      const map = new Map<string, number>();
      let total = 0;
      for (const tx of txs) {
        const cat = tx.betrkvCategory ?? "OHNE_KATEGORIE";
        const amount = Math.abs(tx.amount);
        map.set(cat, (map.get(cat) ?? 0) + amount);
        total += amount;
      }
      return { map, total };
    };

    const current = await sumByCategory(year);
    const previous = await sumByCategory(year - 1);

    const categoryWarnings: { category: string; current: number; previous: number; changePercent: number }[] = [];
    for (const [category, amount] of current.map) {
      const prevAmount = previous.map.get(category) ?? 0;
      if (prevAmount > 0) {
        const changePercent = ((amount - prevAmount) / prevAmount) * 100;
        if (Math.abs(changePercent) > 25) {
          categoryWarnings.push({
            category,
            current: Math.round(amount * 100) / 100,
            previous: Math.round(prevAmount * 100) / 100,
            changePercent: Math.round(changePercent * 10) / 10,
          });
        }
      }
    }
    categoryWarnings.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    const units = await prisma.unit.findMany({
      where: { propertyId, property: { companyId: this.companyId } },
      select: { area: true },
    });
    const totalArea = units.reduce((sum, u) => sum + u.area, 0);
    const costPerSqmPerMonth = totalArea > 0 ? Math.round((current.total / totalArea / 12) * 100) / 100 : null;

    let benchmarkHint: string | null = null;
    if (costPerSqmPerMonth != null) {
      if (costPerSqmPerMonth > 4) {
        benchmarkHint = `Die Betriebskosten liegen mit ${costPerSqmPerMonth.toFixed(2)} €/m²/Monat deutlich über dem üblichen Bereich (ca. 1,50–3,00 €/m²/Monat). Bitte die Positionen prüfen.`;
      } else if (costPerSqmPerMonth > 0 && costPerSqmPerMonth < 0.8) {
        benchmarkHint = `Die Betriebskosten liegen mit ${costPerSqmPerMonth.toFixed(2)} €/m²/Monat auffällig niedrig — möglicherweise fehlen umlagefähige Positionen.`;
      }
    }

    return {
      year,
      previousYear: year - 1,
      hasPreviousData: previous.total > 0,
      costPerSqmPerMonth,
      categoryWarnings,
      benchmarkHint,
    };
  }

  /** Lists persisted statement snapshots (newest first). */
  public async listStatements(propertyId?: number, year?: number) {
    return prisma.utilityStatement.findMany({
      where: {
        companyId: this.companyId,
        ...(propertyId ? { propertyId } : {}),
        ...(year ? { year } : {}),
      },
      include: {
        items: true,
        property: { select: { id: true, name: true } },
      },
      orderBy: { finalizedAt: "desc" },
    });
  }

  /** Fetches one persisted statement snapshot incl. frozen payload. */
  public async getStatement(id: number) {
    const statement = await prisma.utilityStatement.findFirst({
      where: { id, companyId: this.companyId },
      include: { items: true, property: { select: { id: true, name: true } } },
    });
    if (!statement) throw new AppError(404, "Abrechnung nicht gefunden");
    return statement;
  }
}
