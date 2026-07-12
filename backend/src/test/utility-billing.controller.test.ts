import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockGenerateStatement, mockFinalizeStatement, mockListUnallocated } = vi.hoisted(() => ({
  mockGenerateStatement: vi.fn(),
  mockFinalizeStatement: vi.fn(),
  mockListUnallocated: vi.fn(),
}));
vi.mock("../services/utility-billing.service.js", () => ({
  // Regular function (not arrow) so it can be invoked with `new` — the
  // controller calls `new UtilityBillingService(...)`, and arrow functions
  // cannot be used as constructors.
  UtilityBillingService: vi.fn().mockImplementation(function () {
    return {
      generateStatement: mockGenerateStatement,
      finalizeStatement: mockFinalizeStatement,
      listUnallocatedTransactions: mockListUnallocated,
    };
  }),
}));

const { mockListDisputesByCompany, mockUpdateDisputeStatus } = vi.hoisted(() => ({
  mockListDisputesByCompany: vi.fn(),
  mockUpdateDisputeStatus: vi.fn(),
}));
vi.mock("../services/billing-dispute.service.js", () => ({
  listDisputesByCompany: mockListDisputesByCompany,
  updateDisputeStatus: mockUpdateDisputeStatus,
}));

import * as ctrl from "../controllers/utility-billing.controller.js";
import { requireRole } from "../middleware/requireRole.js";

function makeRes() {
  return { json: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis() } as unknown as Response;
}

describe("utility-billing.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requireRole rejects READONLY from generating statements (RBAC gate on the route)", () => {
    const next = vi.fn();
    const req = { user: { id: 1, companyId: 1, role: "READONLY" } } as unknown as Request;
    const res = makeRes();

    requireRole("ADMIN", "VERWALTER", "BUCHHALTER")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("generateStatement scopes the service to req.companyId and merges unallocated transactions into the result", async () => {
    mockGenerateStatement.mockResolvedValueOnce({ year: 2026, propertyId: 3 });
    mockListUnallocated.mockResolvedValueOnce([{ id: 9, description: "Reparatur", amount: -100, category: "" }]);
    const req = { companyId: 1, body: { propertyId: 3, year: 2026 } } as unknown as Request;
    const res = makeRes();

    await ctrl.generateStatement(req, res);

    expect(mockGenerateStatement).toHaveBeenCalledWith(3, 2026);
    expect(mockListUnallocated).toHaveBeenCalledWith(3, 2026);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        year: 2026,
        propertyId: 3,
        unallocatedTransactions: [{ id: 9, description: "Reparatur", amount: -100, category: "" }],
      },
    });
  });

  it("finalizeStatement scopes the service to req.companyId and returns its result", async () => {
    mockFinalizeStatement.mockResolvedValueOnce({ propertyId: 3, year: 2026, generatedCount: 2, items: [] });
    const req = { companyId: 1, body: { propertyId: 3, year: 2026 } } as unknown as Request;
    const res = makeRes();

    await ctrl.finalizeStatement(req, res);

    expect(mockFinalizeStatement).toHaveBeenCalledWith(3, 2026);
    expect(res.json).toHaveBeenCalledWith({ data: { propertyId: 3, year: 2026, generatedCount: 2, items: [] } });
  });

  it("listDisputes forwards the status query param", async () => {
    mockListDisputesByCompany.mockResolvedValueOnce([]);
    const req = { companyId: 1, query: { status: "OPEN" } } as unknown as Request;
    const res = makeRes();

    await ctrl.listDisputes(req, res);

    expect(mockListDisputesByCompany).toHaveBeenCalledWith(1, "OPEN");
  });
});
