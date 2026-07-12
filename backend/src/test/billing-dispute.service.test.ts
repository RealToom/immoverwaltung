import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockFindMany, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    billingDispute: { create: mockCreate, findMany: mockFindMany, findFirst: mockFindFirst, update: mockUpdate },
  },
}));

import * as disputeSvc from "../services/billing-dispute.service.js";

describe("billing-dispute.service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createDispute always starts a dispute as OFFEN and stores the billing year", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1, status: "OFFEN" });
    await disputeSvc.createDispute(1, 42, { reason: "Zu teuer", amount: 50, year: 2025 });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { contractId: 42, companyId: 1, reason: "Zu teuer", amount: 50, year: 2025, status: "OFFEN" },
    });
  });

  it("listDisputesByCompany filters by status when given", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await disputeSvc.listDisputesByCompany(1, "OFFEN");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { companyId: 1, status: "OFFEN" },
      include: { contract: { include: { tenant: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("updateDisputeStatus throws NotFoundError when the dispute belongs to another company", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(disputeSvc.updateDisputeStatus(1, 999, "GELOEST")).rejects.toThrow("nicht gefunden");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
