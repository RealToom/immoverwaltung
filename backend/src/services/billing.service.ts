import Stripe from "stripe";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import type { PlanType } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StripeConstructor = Stripe as any;
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = StripeConstructor(env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe!;
}

export function getPriceIdForPlan(plan: "PRO" | "BUSINESS"): string {
  return plan === "PRO" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_BUSINESS;
}

export function mapPriceIdToPlanType(priceId: string): PlanType | null {
  if (priceId === env.STRIPE_PRICE_PRO) return "PRO";
  if (priceId === env.STRIPE_PRICE_BUSINESS) return "BUSINESS";
  return null;
}

interface CompanyForBilling {
  id: number;
  name: string;
  stripeCustomerId: string | null;
}

export async function getOrCreateStripeCustomer(company: CompanyForBilling): Promise<string> {
  if (company.stripeCustomerId) return company.stripeCustomerId;

  const customer = await getStripe().customers.create({
    name: company.name,
    metadata: { companyId: String(company.id) },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(
  company: CompanyForBilling,
  plan: "PRO" | "BUSINESS",
): Promise<string> {
  try {
    const customerId = await getOrCreateStripeCustomer(company);
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getPriceIdForPlan(plan), quantity: 1 }],
      success_url: `${env.CLIENT_URL}/settings?tab=abo&success=1`,
      cancel_url: `${env.CLIENT_URL}/settings?tab=abo`,
    });
    if (!session.url) throw new AppError(500, "Stripe session URL fehlt");
    return session.url;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, "Stripe checkout session error");
    throw new AppError(502, "Stripe Checkout nicht verfügbar");
  }
}

export async function createPortalSession(company: CompanyForBilling): Promise<string> {
  try {
    const customerId = await getOrCreateStripeCustomer(company);
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.CLIENT_URL}/settings?tab=abo`,
    });
    return session.url;
  } catch (err) {
    logger.error({ err }, "Stripe portal session error");
    throw new AppError(502, "Stripe Portal nicht verfügbar");
  }
}
