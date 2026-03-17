import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Hoist mock functions so vi.mock factories can reference them
const { mockConstructEvent, mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

// Mock Stripe
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
  })),
}));

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    company: { findFirst: mockFindFirst, update: mockUpdate },
  },
}));

// Mock env
vi.mock("../config/env.js", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_WEBHOOK_SECRET: "whsec_mock",
    STRIPE_PRICE_PRO: "price_pro_123",
    STRIPE_PRICE_BUSINESS: "price_biz_456",
    CLIENT_URL: "http://localhost:8080",
  },
}));

import { stripeWebhookHandler } from "../routes/stripe-webhook.routes.js";

function makeReq(body: Buffer, sig: string): Partial<Request> {
  return {
    body,
    headers: { "stripe-signature": sig },
  } as Partial<Request>;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
  return res;
}

describe("stripeWebhookHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips DB update when manualOverride = true on subscription.updated", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1700000000,
          items: { data: [{ price: { id: "price_pro_123" } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockFindFirst.mockResolvedValueOnce({ id: 1, manualOverride: true });

    const req = makeReq(Buffer.from("{}"), "sig_test");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("updates DB on subscription.updated when manualOverride = false", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_456",
          customer: "cus_456",
          status: "active",
          current_period_end: 1700000000,
          items: { data: [{ price: { id: "price_pro_123" } }] },
        },
      },
    };
    mockConstructEvent.mockReturnValueOnce(event);
    mockFindFirst.mockResolvedValueOnce({ id: 2, manualOverride: false });
    mockUpdate.mockResolvedValueOnce({});

    const req = makeReq(Buffer.from("{}"), "sig_test");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({
          subscriptionStatus: "ACTIVE",
          planType: "PRO",
          stripeSubscriptionId: "sub_456",
        }),
      }),
    );
    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });

  it("returns 400 on invalid webhook signature", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found");
    });

    const req = makeReq(Buffer.from("{}"), "bad_sig");
    const res = makeRes();
    await stripeWebhookHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
  });
});
