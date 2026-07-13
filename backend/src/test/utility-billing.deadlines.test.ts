import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPropertyFindMany, mockStatementFindMany, mockTransactionFindMany } = vi.hoisted(() => ({
  mockPropertyFindMany: vi.fn(),
  mockStatementFindMany: vi.fn(),
  mockTransactionFindMany: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    property: { findMany: mockPropertyFindMany },
    utilityStatement: { findMany: mockStatementFindMany },
    transaction: { findMany: mockTransactionFindMany },
  },
}));

import { UtilityBillingService } from "../services/utility-billing.service.js";

describe("UtilityBillingService.getStatementDeadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Pin "today" so daysRemaining is deterministic: 2026-07-13.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13));
  });
  afterEach(() => vi.useRealTimers());

  it("reports an open § 556 deadline for a property with costs but no finalized statement", async () => {
    mockPropertyFindMany.mockResolvedValueOnce([{ id: 1, name: "Residenz Am Park" }]);
    mockStatementFindMany.mockResolvedValueOnce([]); // nothing finalized yet
    mockTransactionFindMany.mockResolvedValueOnce([
      { propertyId: 1, date: new Date(2025, 5, 1) }, // costs in 2025
    ]);

    const svc = new UtilityBillingService(1);
    const deadlines = await svc.getStatementDeadlines();

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0]).toMatchObject({
      propertyId: 1,
      propertyName: "Residenz Am Park",
      year: 2025,
      // Zustellfrist: 31.12.2026 (Periodenende 2025 + 12 Monate)
      deadline: new Date(2026, 11, 31),
      overdue: false,
    });
    expect(deadlines[0].daysRemaining).toBeGreaterThan(0);
  });

  it("omits a property/year that already has a finalized statement", async () => {
    mockPropertyFindMany.mockResolvedValueOnce([{ id: 1, name: "Residenz Am Park" }]);
    mockStatementFindMany.mockResolvedValueOnce([{ propertyId: 1, year: 2025 }]);
    mockTransactionFindMany.mockResolvedValueOnce([{ propertyId: 1, date: new Date(2025, 5, 1) }]);

    const svc = new UtilityBillingService(1);
    const deadlines = await svc.getStatementDeadlines();

    expect(deadlines).toHaveLength(0);
  });

  it("omits a property/year with no allocatable costs (nothing to bill)", async () => {
    mockPropertyFindMany.mockResolvedValueOnce([{ id: 2, name: "Leeres Haus" }]);
    mockStatementFindMany.mockResolvedValueOnce([]);
    mockTransactionFindMany.mockResolvedValueOnce([]); // no costs anywhere

    const svc = new UtilityBillingService(1);
    const deadlines = await svc.getStatementDeadlines();

    expect(deadlines).toHaveLength(0);
  });

  it("flags an overdue deadline for an unbilled prior year", async () => {
    mockPropertyFindMany.mockResolvedValueOnce([{ id: 1, name: "Residenz Am Park" }]);
    mockStatementFindMany.mockResolvedValueOnce([]);
    mockTransactionFindMany.mockResolvedValueOnce([{ propertyId: 1, date: new Date(2024, 5, 1) }]);

    const svc = new UtilityBillingService(1);
    const deadlines = await svc.getStatementDeadlines();

    // 2024 → deadline 31.12.2025, already past on 13.07.2026.
    const overdue = deadlines.find((d) => d.year === 2024);
    expect(overdue).toBeDefined();
    expect(overdue!.overdue).toBe(true);
    expect(overdue!.daysRemaining).toBeLessThan(0);
  });
});
