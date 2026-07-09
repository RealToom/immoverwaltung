import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { transaction: { findFirst: mockFindFirst, update: mockUpdate } },
}));

import { updateTransaction } from "../services/finance.service.js";

describe("finance.service updateTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes betrkvCategory and co2TaxAmount through to prisma.transaction.update", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 5, companyId: 1 });
    mockUpdate.mockResolvedValueOnce({ id: 5, betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 });

    await updateTransaction(1, 5, { betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { betrkvCategory: "WASSERVERSORGUNG", co2TaxAmount: 42.5 },
    });
  });
});
