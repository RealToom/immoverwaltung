import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockTenantFindUnique, mockMeterFindMany, mockMeterFindFirst, mockMeterReadingCreate,
  mockContractFindFirst, mockStatementFindFirst, mockStatementItemUpdate,
} = vi.hoisted(() => ({
  mockTenantFindUnique: vi.fn(),
  mockMeterFindMany: vi.fn(),
  mockMeterFindFirst: vi.fn(),
  mockMeterReadingCreate: vi.fn(),
  mockContractFindFirst: vi.fn(),
  mockStatementFindFirst: vi.fn(),
  mockStatementItemUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    tenant: { findUnique: mockTenantFindUnique },
    meter: { findMany: mockMeterFindMany, findFirst: mockMeterFindFirst },
    meterReading: { create: mockMeterReadingCreate },
    contract: { findFirst: mockContractFindFirst },
    utilityStatement: { findFirst: mockStatementFindFirst },
    utilityStatementItem: { update: mockStatementItemUpdate },
  },
}));

import { getOwnMeters, addOwnMeterReading, getUtilitySummary } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service utility/meters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getOwnMeters only queries meters attached to the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }, { id: 6 }] });
    mockMeterFindMany.mockResolvedValueOnce([]);

    await getOwnMeters(tenantUser);

    expect(mockMeterFindMany).toHaveBeenCalledWith({
      where: { companyId: 1, unitId: { in: [5, 6] } },
      include: { readings: { orderBy: { readAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    });
  });

  it("addOwnMeterReading rejects a meter that isn't on one of the tenant's own units", async () => {
    mockTenantFindUnique.mockResolvedValueOnce({ units: [{ id: 5 }] });
    mockMeterFindFirst.mockResolvedValueOnce(null); // meter 99 belongs to unit 7, filtered out by unitId: { in: [5] }

    await expect(
      addOwnMeterReading(tenantUser, 99, { value: 100, readAt: "2026-01-01T00:00:00.000Z" })
    ).rejects.toThrow("nicht gefunden");

    expect(mockMeterReadingCreate).not.toHaveBeenCalled();
  });

  it("getUtilitySummary serves the frozen snapshot when a finalized statement exists (and stamps viewedAt)", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockStatementFindFirst.mockResolvedValueOnce({
      id: 500,
      status: "FINALISIERT",
      data: {
        transactions: [{ amount: -1200, betrkvCategory: "GRUNDSTEUER" }],
      },
      items: [
        {
          id: 9001, contractId: 77, amount: 600, heatingAmount: 0,
          totalPrepaid: 500, balance: -100, isRefund: false,
          suggestedPrepayment: 50, viewedAt: null,
        },
      ],
    });
    mockStatementItemUpdate.mockResolvedValueOnce({});

    const result = await getUtilitySummary(tenantUser, 2025);

    expect(result.finalized).toBe(true);
    expect(result.totalCosts).toBe(600);
    expect(result.totalPrepaid).toBe(500);
    expect(result.balance).toBe(-100);
    expect(result.categories).toEqual([
      { category: "GRUNDSTEUER", label: "Grundsteuer", amount: 600 },
    ]);
    // first portal view is recorded for the § 556 delivery trail
    expect(mockStatementItemUpdate).toHaveBeenCalledWith({
      where: { id: 9001 },
      data: { viewedAt: expect.any(Date) },
    });
  });
});
