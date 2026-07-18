import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTxFindMany } = vi.hoisted(() => ({ mockTxFindMany: vi.fn() }));

vi.mock("../lib/prisma.js", () => ({
  prisma: { transaction: { findMany: mockTxFindMany } },
}));

import { getRevenueSeries } from "../services/dashboard.service.js";

describe("getRevenueSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 12 buckets and sums income into the current month", async () => {
    const now = new Date();
    mockTxFindMany.mockResolvedValueOnce([
      { date: new Date(now.getFullYear(), now.getMonth(), 5), amount: 1000 },
      { date: new Date(now.getFullYear(), now.getMonth(), 20), amount: 500 },
    ]);
    const out = await getRevenueSeries(1);
    expect(out).toHaveLength(12);
    expect(out[11].total).toBe(1500); // aktueller Monat = letzter Bucket
    expect(out[0].total).toBe(0);
  });
});
