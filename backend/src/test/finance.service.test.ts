import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockUpdate, mockCreate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: { transaction: { findFirst: mockFindFirst, update: mockUpdate, create: mockCreate } },
}));

import { updateTransaction, createTransaction } from "../services/finance.service.js";

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

describe("finance.service createTransaction sign convention", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores AUSGABE amounts negative regardless of input sign", async () => {
    mockCreate.mockResolvedValueOnce({ id: 1 });
    await createTransaction(1, { date: new Date(), description: "Grundsteuer", type: "AUSGABE", amount: 1200 });
    expect(mockCreate.mock.calls[0][0].data.amount).toBe(-1200);
  });

  it("stores EINNAHME amounts positive regardless of input sign", async () => {
    mockCreate.mockResolvedValueOnce({ id: 2 });
    await createTransaction(1, { date: new Date(), description: "Miete", type: "EINNAHME", amount: -800 });
    expect(mockCreate.mock.calls[0][0].data.amount).toBe(800);
  });
});
