// backend/src/test/utility-billing.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockEnergyPassportFindUnique, mockContractFindUnique, mockRentPaymentFindMany,
  mockPropertyFindFirst, mockTransactionFindMany, mockUnitFindMany, mockContractFindMany,
} = vi.hoisted(() => ({
  mockEnergyPassportFindUnique: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockRentPaymentFindMany: vi.fn(),
  mockPropertyFindFirst: vi.fn(),
  mockTransactionFindMany: vi.fn(),
  mockUnitFindMany: vi.fn(),
  mockContractFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    energyPassport: { findUnique: mockEnergyPassportFindUnique },
    contract: { findUnique: mockContractFindUnique, findMany: mockContractFindMany },
    rentPayment: { findMany: mockRentPaymentFindMany },
    property: { findFirst: mockPropertyFindFirst },
    transaction: { findMany: mockTransactionFindMany },
    unit: { findMany: mockUnitFindMany },
  },
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

describe("UtilityBillingService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("calculateProRataFixedCosts", () => {
    it("returns full costs when tenant lived the whole year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2025, 0, 1), null);
      expect(result).toBe(1200);
    });

    it("pro-rates costs for a tenant who moved in mid-year", () => {
      const svc = new UtilityBillingService(1);
      // Moved in July 1, 2026 (not a leap year) -> 184 days of 365
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2026, 6, 1), null);
      expect(result).toBeCloseTo(1200 * (184 / 365), 2);
    });

    it("returns 0 when the tenant moved out before the billing year started", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateProRataFixedCosts(1200, 2026, new Date(2020, 0, 1), new Date(2025, 11, 31));
      expect(result).toBe(0);
    });
  });

  describe("calculateHeatingBaseCostPercentage", () => {
    it("returns 100% for a full calendar year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateHeatingBaseCostPercentage(2026, new Date(2026, 0, 1), null);
      expect(result).toBeCloseTo(100, 1);
    });

    it("returns 0% when the tenant's period doesn't overlap the billing year", () => {
      const svc = new UtilityBillingService(1);
      const result = svc.calculateHeatingBaseCostPercentage(2026, new Date(2020, 0, 1), new Date(2025, 11, 31));
      expect(result).toBe(0);
    });
  });

  describe("applyCO2Stufenmodell", () => {
    it("applies 0% landlord share below 12 kg CO2/m2/a", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce({ co2Emissions: 10 });
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 200);
      expect(result).toEqual({ tenantShare: 200, landlordShare: 0, landlordPercentage: 0 });
    });

    it("applies 60% landlord share in the 37-42 kg CO2/m2/a tier", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce({ co2Emissions: 38.5 });
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 245.6);
      expect(result.landlordPercentage).toBe(60);
      expect(result.landlordShare).toBeCloseTo(147.36, 2);
      expect(result.tenantShare).toBeCloseTo(98.24, 2);
    });

    it("falls back to 50/50 when no EnergyPassport exists", async () => {
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
      const svc = new UtilityBillingService(1);
      const result = await svc.applyCO2Stufenmodell(1, 100);
      expect(result).toEqual({ tenantShare: 50, landlordShare: 50, landlordPercentage: 50 });
    });
  });

  describe("calculateBalance", () => {
    it("sums monthly utilityPrepayment across fully-paid months into totalPrepaid", async () => {
      mockContractFindUnique.mockResolvedValueOnce({
        id: 1, companyId: 1, monthlyRent: 800, utilityPrepayment: 100,
      });
      mockRentPaymentFindMany.mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, i) => ({
          id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH",
        }))
      );
      const svc = new UtilityBillingService(1);
      const result = await svc.calculateBalance(1, 2026, 1000);
      expect(result.totalPrepaid).toBe(1200);
      expect(result.balance).toBe(200);
      expect(result.isRefund).toBe(true);
      expect(result.isAdditionalPayment).toBe(false);
    });

    it("throws when the contract belongs to a different company", async () => {
      mockContractFindUnique.mockResolvedValueOnce({ id: 1, companyId: 2, monthlyRent: 800, utilityPrepayment: 100 });
      const svc = new UtilityBillingService(1);
      await expect(svc.calculateBalance(1, 2026, 1000)).rejects.toThrow("Vertrag nicht gefunden");
    });
  });

  describe("generateStatement", () => {
    it("throws when the property doesn't belong to this company", async () => {
      mockPropertyFindFirst.mockResolvedValueOnce(null);
      const svc = new UtilityBillingService(1);
      await expect(svc.generateStatement(99, 2026)).rejects.toThrow("Immobilie nicht gefunden");
    });

    it("computes a full-year, single-unit, no-vacancy, no-CO2 statement", async () => {
      mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
      mockTransactionFindMany.mockResolvedValueOnce([
        { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null); // direct fetch for co2 card details
      mockUnitFindMany.mockResolvedValueOnce([
        {
          id: 5, number: "EG links", area: 50,
          contracts: [{ startDate: new Date(2025, 0, 1), endDate: null }],
        },
      ]);
      mockContractFindMany.mockResolvedValueOnce([
        {
          id: 42, startDate: new Date(2025, 0, 1), endDate: null,
          unit: { id: 5, number: "EG links", area: 50 },
          tenant: { id: 7, name: "Mustermann" },
        },
      ]);
      mockContractFindUnique.mockResolvedValueOnce({ id: 42, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
      mockRentPaymentFindMany.mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, i) => ({ id: i, amountDue: 900, amountPaid: 900, status: "PUENKTLICH" }))
      );

      const svc = new UtilityBillingService(1);
      const result = await svc.generateStatement(1, 2026);

      expect(result.totalCosts).toBe(1200);
      expect(result.co2).toEqual({ energyClass: null, co2Emissions: null, landlordPercentage: 0, tenantShare: 0, landlordShare: 0 });
      expect(result.vacancy).toBeNull();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ contractId: 42, unitId: 5, unitNumber: "EG links", tenantName: "Mustermann", amount: 1200, balance: 0, isRefund: false });
      expect(result.transactions).toEqual([
        { id: 10, description: "Grundsteuer", amount: -1200, betrkvCategory: "GRUNDSTEUER", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
    });

    it("reconciles a single unit with a mid-year tenant swap (zero vacancy, catches area double-counting)", async () => {
      // Property: 1 unit (area 50 m2), full year covered by two back-to-back contracts
      // on the SAME unit, no gap between them:
      //   Contract 1: 2026-01-01 .. 2026-02-28  -> 59 days
      //   Contract 2: 2026-03-01 .. (no end)    -> 306 days
      // 59 + 306 = 365 (2026 is not a leap year) -> zero vacancy days.
      // (The split was originally placed before Germany's 2026 DST transition on
      // 2026-03-29 to sidestep a since-fixed drift bug: calculateVacancyDeduction's
      // day-by-day loop used to advance "current" by a fixed 24h in epoch-ms, which
      // drifted against local wall-clock midnight once a DST transition was crossed.
      // That loop now advances via date-fns's addDays, which is calendar-day-aware
      // and immune to DST drift, so the exact split date no longer matters for
      // correctness -- it's left as-is here since changing it isn't required and
      // the test still passes.)
      // Single AUSGABE transaction of 1200, no CO2.
      //
      // Old (buggy) code: totalArea = 50 + 50 = 100 (the unit's area was summed once per
      // contract row, double-counting it). Each contract's areaShare = 1200 * (50/100) = 600,
      // and calculateProRataFixedCosts then re-applied the occupancy fraction ON TOP of that
      // already-halved pool:
      //   contract 1: 600 * (59/365)  = 96.99
      //   contract 2: 600 * (306/365) = 503.01
      //   sum = 600.00  <- half of the 1200 cost pool silently disappears
      //
      // Fixed code: weight = area * occupancyFraction, shares normalized to sum to netAllocatable:
      //   totalWeight = 50*(59/365) + 50*(306/365) = 50*(365/365) = 50
      //   share 1 = 1200 * (50*(59/365) / 50)  = 1200 * (59/365)  = 193.9726...  -> 193.97
      //   share 2 = 1200 * (50*(306/365) / 50) = 1200 * (306/365) = 1006.0274... -> 1006.03
      //   sum = 1200.00 == totalCosts (no vacancy, no CO2 -> netAllocatable == totalCosts)
      mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
      mockTransactionFindMany.mockResolvedValueOnce([
        { id: 20, description: "Betriebskosten", amount: -1200, betrkvCategory: "SONSTIGES", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
      mockUnitFindMany.mockResolvedValueOnce([
        {
          id: 5, number: "EG links", area: 50,
          contracts: [
            { startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 28) },
            { startDate: new Date(2026, 2, 1), endDate: null },
          ],
        },
      ]);
      mockContractFindMany.mockResolvedValueOnce([
        {
          id: 1, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 28),
          unit: { id: 5, number: "EG links", area: 50 },
          tenant: { id: 7, name: "Erster Mieter" },
        },
        {
          id: 2, startDate: new Date(2026, 2, 1), endDate: null,
          unit: { id: 5, number: "EG links", area: 50 },
          tenant: { id: 8, name: "Zweiter Mieter" },
        },
      ]);
      mockContractFindUnique.mockResolvedValueOnce({ id: 1, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
      mockRentPaymentFindMany.mockResolvedValueOnce([]);
      mockContractFindUnique.mockResolvedValueOnce({ id: 2, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
      mockRentPaymentFindMany.mockResolvedValueOnce([]);

      const svc = new UtilityBillingService(1);
      const result = await svc.generateStatement(1, 2026);

      expect(result.vacancy).toBeNull();
      expect(result.items).toHaveLength(2);
      expect(result.items[0].amount).toBeCloseTo(193.97, 1);
      expect(result.items[1].amount).toBeCloseTo(1006.03, 1);

      const total = result.items.reduce((sum, i) => sum + i.amount, 0);
      expect(total + (result.vacancy?.amount ?? 0) + result.co2.landlordShare).toBeCloseTo(result.totalCosts, 1);
    });

    it("nets a real vacancy gap: single contract covers only H1, unit sits empty in H2", async () => {
      // Property: 1 unit (area 50 m2). ONE contract covers only Jan 1 - Jun 30, 2026
      // (181 days); Jul 1 - Dec 31 (184 days) has no contract at all -> a genuine gap,
      // not a second back-to-back contract. 2026 is not a leap year (365 days).
      // Single AUSGABE transaction of 1200, no CO2 (co2TaxAmount: 0), so
      // totalAllocatable == grossCosts == 1200.
      //
      // Hand-traced via calculateVacancyDeduction/generateStatement (verified with a
      // throwaway node script exercising the actual date-fns calls):
      //   calculateVacancyDeduction:
      //     unit.contracts = [{ start: 2026-01-01, end: 2026-06-30 }]
      //     day-loop over Jan 1 .. Dec 31: active Jan 1 - Jun 30 (181 days),
      //     vacant Jul 1 - Dec 31 -> unitVacancyDays = 184 (365 - 181)
      //     totalVacancyDays = 184, totalUnitDays = 1 unit * 365 = 365
      //     vacancyRatio = 184/365 = 0.50410958...
      //     amount = 1200 * (184/365) = 604.931506849... -> rounded 604.93
      //   generateStatement:
      //     netAllocatable = 1200 - 604.931506849... = 595.068493151...
      //     contracts query returns the SAME single contract (Jan 1 - Jun 30)
      //     occupancyFraction = calculateProRataFixedCosts(1, 2026, Jan1, Jun30)
      //       = (differenceInDays(Jun30,Jan1)+1) / 365 = 181/365 = 0.495890410958...
      //     weight = area(50) * occupancyFraction = 24.7945205479...
      //     totalWeight = weight (only one contract) -> share = netAllocatable * 1
      //     items[0].amount = round(595.068493151..., 2) = 595.07
      //   Reconciliation: 604.931506849... + 595.068493151... = 1200.00 == totalCosts
      mockPropertyFindFirst.mockResolvedValueOnce({ id: 1, companyId: 1 });
      mockTransactionFindMany.mockResolvedValueOnce([
        { id: 30, description: "Betriebskosten", amount: -1200, betrkvCategory: "SONSTIGES", maintenanceWarning: null, co2TaxAmount: 0 },
      ]);
      mockEnergyPassportFindUnique.mockResolvedValueOnce(null);
      mockUnitFindMany.mockResolvedValueOnce([
        {
          id: 5, number: "EG links", area: 50,
          contracts: [{ startDate: new Date(2026, 0, 1), endDate: new Date(2026, 5, 30) }],
        },
      ]);
      mockContractFindMany.mockResolvedValueOnce([
        {
          id: 1, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 5, 30),
          unit: { id: 5, number: "EG links", area: 50 },
          tenant: { id: 7, name: "Erster Mieter" },
        },
      ]);
      mockContractFindUnique.mockResolvedValueOnce({ id: 1, companyId: 1, monthlyRent: 800, utilityPrepayment: 100 });
      mockRentPaymentFindMany.mockResolvedValueOnce([]);

      const svc = new UtilityBillingService(1);
      const result = await svc.generateStatement(1, 2026);

      expect(result.vacancy).not.toBeNull();
      expect(result.vacancy?.vacancyDays).toBe(184);
      expect(result.vacancy?.affectedUnits).toEqual(["EG links"]);
      expect(result.vacancy?.amount).toBeCloseTo(604.93, 2);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].amount).toBeCloseTo(595.07, 2);

      const total = result.items.reduce((sum, i) => sum + i.amount, 0);
      expect(total + (result.vacancy?.amount ?? 0) + result.co2.landlordShare).toBeCloseTo(result.totalCosts, 1);
    });
  });
});
