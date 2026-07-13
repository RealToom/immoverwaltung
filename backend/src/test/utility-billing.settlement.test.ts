import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockItemFindFirst, mockItemUpdate } = vi.hoisted(() => ({
  mockItemFindFirst: vi.fn(),
  mockItemUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    utilityStatementItem: { findFirst: mockItemFindFirst, update: mockItemUpdate },
  },
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

describe("UtilityBillingService.updateSettlementStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks an item BEZAHLT and stamps settledAt", async () => {
    mockItemFindFirst.mockResolvedValueOnce({ id: 9001, companyId: 1 });
    mockItemUpdate.mockResolvedValueOnce({ id: 9001, settlementStatus: "BEZAHLT", settledAt: new Date() });

    const svc = new UtilityBillingService(1);
    await svc.updateSettlementStatus(9001, "BEZAHLT");

    expect(mockItemFindFirst).toHaveBeenCalledWith({ where: { id: 9001, companyId: 1 } });
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: 9001 },
      data: { settlementStatus: "BEZAHLT", settledAt: expect.any(Date) },
      select: { id: true, settlementStatus: true, settledAt: true },
    });
  });

  it("clears settledAt when reset to OFFEN", async () => {
    mockItemFindFirst.mockResolvedValueOnce({ id: 9001, companyId: 1 });
    mockItemUpdate.mockResolvedValueOnce({ id: 9001, settlementStatus: "OFFEN", settledAt: null });

    const svc = new UtilityBillingService(1);
    await svc.updateSettlementStatus(9001, "OFFEN");

    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: 9001 },
      data: { settlementStatus: "OFFEN", settledAt: null },
      select: { id: true, settlementStatus: true, settledAt: true },
    });
  });

  it("rejects an item from another company", async () => {
    mockItemFindFirst.mockResolvedValueOnce(null);
    const svc = new UtilityBillingService(1);
    await expect(svc.updateSettlementStatus(9999, "BEZAHLT")).rejects.toThrow();
  });
});
