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
      // (The split is deliberately placed before Germany's 2026 DST transition on
      // 2026-03-29 -- calculateVacancyDeduction's day-by-day loop advances "current"
      // by a fixed 24h in epoch-ms, which drifts against local wall-clock midnight
      // once a DST transition is crossed; contract 2 has no endDate so its coverage
      // check short-circuits on `!c.endDate` and is immune to that drift, and
      // contract 1's exact-equality endDate check only needs to hold for days
      // before the transition, which Feb 28 satisfies. This is a pre-existing
      // quirk of calculateVacancyDeduction, unrelated to and out of scope for this
      // fix -- picking a pre-DST split date avoids it entirely.)
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
  });
});
