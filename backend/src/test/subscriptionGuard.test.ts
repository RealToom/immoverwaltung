import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: { company: { findUnique: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { subscriptionGuard } from "../middleware/subscriptionGuard.js";

function makeReq(companyId: number): Partial<Request> {
  return { companyId } as Partial<Request>;
}
function makeRes(): Partial<Response> {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as Partial<Response>;
}

const now = new Date();
const future = new Date(now.getTime() + 86400_000); // +1 day
const past = new Date(now.getTime() - 86400_000);   // -1 day

describe("subscriptionGuard", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("passes ACTIVE subscription", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "ACTIVE", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(); // called with no args = pass
    expect(res.status).not.toHaveBeenCalled();
  });

  it("passes MANUAL override", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "MANUAL", planType: "PRO", trialEndsAt: null, manualOverride: true,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes TRIAL with future trialEndsAt", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "TRIAL", planType: "TRIAL", trialEndsAt: future, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks TRIAL with past trialEndsAt → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "TRIAL", planType: "TRIAL", trialEndsAt: past, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({ error: { message: "SUBSCRIPTION_REQUIRED" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks PAST_DUE → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "PAST_DUE", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks CANCELED → 402", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      subscriptionStatus: "CANCELED", planType: "PRO", trialEndsAt: null, manualOverride: false,
    } as any);
    const req = makeReq(1);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes when company not found (fail open — let downstream handle 404)", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);
    const req = makeReq(999);
    const res = makeRes();
    await subscriptionGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
