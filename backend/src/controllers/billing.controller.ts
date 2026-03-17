import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { checkoutSchema } from "../schemas/billing.schema.js";
import { createCheckoutSession, createPortalSession } from "../services/billing.service.js";

export async function getBillingStatus(req: Request, res: Response): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: {
      subscriptionStatus: true,
      planType: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      manualOverride: true,
    },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");
  res.json({ data: company });
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const { plan } = checkoutSchema.parse(req.body);

  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  const url = await createCheckoutSession(company, plan);
  res.json({ data: { url } });
}

export async function createPortal(req: Request, res: Response): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: req.companyId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!company) throw new AppError(404, "Firma nicht gefunden");

  const url = await createPortalSession(company);
  res.json({ data: { url } });
}
