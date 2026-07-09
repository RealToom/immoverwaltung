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

  it("sets contractId from the tenant's own active contract, never from client input", async () => {
    mockContractFindFirst.mockResolvedValueOnce({ id: 77, propertyId: 3 });
    mockDisputeCreate.mockResolvedValueOnce({ id: 1, status: "OPEN" });

    await createDispute(tenantUser, { reason: "Gartenpflege zu teuer", amount: 40 });

    expect(mockContractFindFirst).toHaveBeenCalledWith({
      where: { tenantId: 10, companyId: 1, status: "AKTIV" },
      orderBy: { startDate: "desc" },
    });
    expect(mockDisputeCreate).toHaveBeenCalledWith({
      data: { contractId: 77, companyId: 1, reason: "Gartenpflege zu teuer", amount: 40, status: "OPEN" },
    });
  });
});
