import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe
const mockCustomersCreate = vi.fn();
const mockCustomersUpdate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: {
        create: mockCustomersCreate,
        update: mockCustomersUpdate,
      },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
    })),
  };
});

// Mock prisma
vi.mock("../lib/prisma.js", () => ({
  prisma: { company: { update: vi.fn() } },
}));

// Mock env
vi.mock("../config/env.js", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    STRIPE_PRICE_PRO: "price_pro_123",
    STRIPE_PRICE_BUSINESS: "price_biz_456",
    CLIENT_URL: "http://localhost:8080",
  },
}));

import { getOrCreateStripeCustomer, getPriceIdForPlan, mapPriceIdToPlanType } from "../services/billing.service.js";
import { prisma } from "../lib/prisma.js";

describe("billing.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrCreateStripeCustomer", () => {
    it("returns existing customerId without calling Stripe", async () => {
      const company = { id: 1, name: "Test GmbH", stripeCustomerId: "cus_existing" } as any;
      const result = await getOrCreateStripeCustomer(company);
      expect(result).toBe("cus_existing");
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("creates new customer and persists to DB when none exists", async () => {
      mockCustomersCreate.mockResolvedValueOnce({ id: "cus_new123" });
      vi.mocked(prisma.company.update).mockResolvedValueOnce({} as any);

      const company = { id: 2, name: "Neue GmbH", stripeCustomerId: null } as any;
      const result = await getOrCreateStripeCustomer(company);

      expect(result).toBe("cus_new123");
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        name: "Neue GmbH",
        metadata: { companyId: "2" },
      });
      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { stripeCustomerId: "cus_new123" },
      });
    });
  });

  describe("getPriceIdForPlan", () => {
    it("returns PRO price ID for PRO plan", () => {
      expect(getPriceIdForPlan("PRO")).toBe("price_pro_123");
    });

    it("returns BUSINESS price ID for BUSINESS plan", () => {
      expect(getPriceIdForPlan("BUSINESS")).toBe("price_biz_456");
    });
  });

  describe("mapPriceIdToPlanType", () => {
    it("maps PRO price ID to PRO", () => {
      expect(mapPriceIdToPlanType("price_pro_123")).toBe("PRO");
    });

    it("maps BUSINESS price ID to BUSINESS", () => {
      expect(mapPriceIdToPlanType("price_biz_456")).toBe("BUSINESS");
    });

    it("returns null for unknown price ID", () => {
      expect(mapPriceIdToPlanType("price_unknown")).toBeNull();
    });
  });
});
