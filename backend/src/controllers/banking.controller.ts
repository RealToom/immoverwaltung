import type { Request, Response } from "express";
import * as bankingService from "../services/banking.service.js";
import * as nordigenService from "../services/nordigen.service.js";
import * as matchingService from "../services/matching.service.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

// GET /banking/institutions?country=DE
export async function listInstitutions(req: Request, res: Response): Promise<void> {
  const country = ((req.query.country as string) || "DE").toUpperCase();
  const institutions = await nordigenService.listInstitutions(country);
  res.json({ data: institutions });
}

// POST /banking/requisitions  { bankAccountId, institutionId }
export async function initiateRequisition(req: Request, res: Response): Promise<void> {
  const { bankAccountId, institutionId } = req.body as { bankAccountId: number; institutionId: string };

  // Store institutionId on the BankAccount so bankingService.initiateRequisition can use it
  await prisma.bankAccount.update({
    where: { id: bankAccountId, companyId: req.companyId! },
    data: { institutionId, provider: "NORDIGEN" },
  });

  const result = await bankingService.initiateRequisition(req.companyId!, bankAccountId, req.userId!);
  res.status(201).json({ data: result });
}

// GET /banking/callback?ref=<requisitionId>  — PUBLIC, no auth
export async function handleCallback(req: Request, res: Response): Promise<void> {
  const ref = req.query.ref as string;
  if (!ref) {
    res.redirect(`${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?error=missing_ref`);
    return;
  }

  try {
    const redirectUrl = await bankingService.handleCallback(ref);
    res.redirect(redirectUrl);
  } catch {
    res.redirect(`${env.NORDIGEN_REDIRECT_BASE}/bank-accounts?error=callback_failed`);
  }
}

// GET /banking/accounts/:id/status
// NOTE: requisitionId and nordigenAccountId are intentionally omitted from the response
// to avoid exposing internal Nordigen identifiers that could enable direct Nordigen API access.
export async function getAccountStatus(req: Request, res: Response): Promise<void> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: Number(req.params.id), companyId: req.companyId! },
    select: {
      id: true, name: true, status: true, provider: true,
      lastSync: true, iban: true,
    },
  });
  if (!account) {
    res.status(404).json({ error: "Bankkonto nicht gefunden" });
    return;
  }

  res.json({
    data: {
      ...account,
      iban: nordigenService.maskIban(account.iban),
    },
  });
}

// POST /banking/accounts/:id/sync
export async function syncAccount(req: Request, res: Response): Promise<void> {
  const result = await bankingService.syncBankAccount(req.companyId!, Number(req.params.id));
  res.json({ data: result });
}

// GET /banking/accounts/:id/transactions
export async function listTransactions(req: Request, res: Response): Promise<void> {
  const result = await bankingService.listBankTransactions(req.companyId!, Number(req.params.id), {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    status: req.query.status as string | undefined,
  });
  res.json(result);
}

// POST /banking/accounts/:id/transactions/:txId/ignore
export async function ignoreTransaction(req: Request, res: Response): Promise<void> {
  await bankingService.ignoreBankTransaction(req.companyId!, Number(req.params.txId));
  res.status(204).end();
}

// POST /banking/match
export async function runMatching(req: Request, res: Response): Promise<void> {
  const result = await matchingService.matchPendingTransactions(req.companyId!);
  res.json({ data: result });
}
