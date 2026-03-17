import { z } from "zod";

export const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export const updateSubscriptionSchema = z.object({
  planType: z.enum(["TRIAL", "PRO", "BUSINESS"]),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED", "MANUAL"]),
  manualOverride: z.boolean(),
  currentPeriodEnd: z.string().datetime().optional().nullable(),
});
