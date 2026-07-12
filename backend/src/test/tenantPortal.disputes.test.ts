import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockContractFindFirst, mockDisputeCreate } = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockDisputeCreate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contract: { findFirst: mockContractFindFirst },
    billingDispute: { create: mockDisputeCreate },
  },
}));

import { createDispute } from "../services/tenantPortal.service.js";

const tenantUser = { id: 1, tenantId: 10, companyId: 1 };

describe("tenantPortal.service createDispute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets contractId from the tenant's own contract, never from client input, and stores the year", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockDisputeCreate.mockResolvedValueOnce({ id: 1, status: "OFFEN" });

    await createDispute(tenantUser, { year: 2025, reason: "Gartenpflege zu teuer", amount: 40 });

    // Contract lookup must scope by tenant+company and target the billing
    // year, NOT require status AKTIV — ex-tenants receive their final
    // statement after move-out and keep the 12-month § 556 BGB objection window.
    const where = mockContractFindFirst.mock.calls[0][0].where;
    expect(where.tenantId).toBe(10);
    expect(where.companyId).toBe(1);
    expect(where.status).toBeUndefined();
    expect(where.startDate).toEqual({ lte: new Date(2025, 11, 31) });
    expect(where.OR).toEqual([{ endDate: null }, { endDate: { gte: new Date(2025, 0, 1) } }]);

    expect(mockDisputeCreate).toHaveBeenCalledWith({
      data: { contractId: 77, companyId: 1, reason: "Gartenpflege zu teuer", amount: 40, year: 2025, status: "OFFEN" },
    });
  });

  it("falls back to the most recent contract when no year is given", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockDisputeCreate.mockResolvedValueOnce({ id: 1, status: "OFFEN" });

    await createDispute(tenantUser, { reason: "Heizkosten erscheinen zu hoch" });

    const where = mockContractFindFirst.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(mockDisputeCreate).toHaveBeenCalledWith({
      data: { contractId: 77, companyId: 1, reason: "Heizkosten erscheinen zu hoch", amount: null, year: null, status: "OFFEN" },
    });
  });
});
