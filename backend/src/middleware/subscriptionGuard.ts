import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

export async function subscriptionGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const companyId = req.companyId;
  if (!companyId) {
    next();
    return;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionStatus: true,
      planType: true,
      trialEndsAt: true,
      manualOverride: true,
    },
  });

  if (!company) {
    next();
    return;
  }

  const { subscriptionStatus, trialEndsAt, manualOverride } = company;

  // Always pass manual overrides
  if (manualOverride || subscriptionStatus === "MANUAL") {
    next();
    return;
  }

  // Active subscription
  if (subscriptionStatus === "ACTIVE") {
    next();
    return;
  }

  // Trial — check expiry
  if (subscriptionStatus === "TRIAL") {
    if (trialEndsAt && trialEndsAt >= new Date()) {
      next();
      return;
    }
    res.status(402).json({ error: { message: "SUBSCRIPTION_REQUIRED" } });
    return;
  }

  // PAST_DUE or CANCELED
  res.status(402).json({ error: { message: "SUBSCRIPTION_REQUIRED" } });
}
