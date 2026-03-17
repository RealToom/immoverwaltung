import type { Request, Response } from "express";
import Stripe from "stripe";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { mapPriceIdToPlanType } from "../services/billing.service.js";
import type { SubscriptionStatus, PlanType } from "@prisma/client";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const StripeConstructor = Stripe as any;
    _stripe = StripeConstructor(env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe!;
}

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "CANCELED";
  }
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature mismatch");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, manualOverride: true, planType: true },
    });

    if (!company) {
      logger.warn({ customerId }, "Stripe webhook: company not found for customer");
      res.sendStatus(200);
      return;
    }

    if (company.manualOverride) {
      res.sendStatus(200);
      return;
    }

    const newStatus = mapStripeStatus(sub.status);
    const priceId = sub.items.data[0]?.price?.id;
    const mappedPlan = priceId ? mapPriceIdToPlanType(priceId) : null;

    if (priceId && !mappedPlan) {
      logger.warn({ priceId }, "Stripe webhook: unknown price ID — keeping existing planType");
    }

    await prisma.company.update({
      where: { id: company.id },
      data: {
        subscriptionStatus: newStatus,
        planType: (mappedPlan ?? company.planType) as PlanType,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const company = await prisma.company.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true, manualOverride: true },
    });

    if (!company || company.manualOverride) {
      res.sendStatus(200);
      return;
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { subscriptionStatus: "CANCELED" },
    });
  }

  res.sendStatus(200);
}
