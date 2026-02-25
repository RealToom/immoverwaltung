import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError, NotFoundError } from "../lib/errors.js";
import { env } from "../config/env.js";
import * as nordigen from "./nordigen.service.js";
import { createAuditLog } from "./audit.service.js";

// ── initiateRequisition ───────────────────────────────────────────────────────

export async function initiateRequisition(
  companyId: number,
  bankAccountId: number,
  userId: number
): Promise<{ link: string }> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
  });
  if (!account) throw new NotFoundError("BankAccount", bankAccountId);

  if (!account.institutionId) {
    throw new AppError(400, "institutionId muss gesetzt sein um eine Nordigen-Verbindung zu starten");
  }

  const redirectUrl = env.NORDIGEN_REDIRECT_BASE + "/api/banking/callback";
  const reference = `company-${companyId}-account-${bankAccountId}-${Date.now()}`;

  const requisition = await nordigen.createRequisition(
    account.institutionId,
    redirectUrl,
    reference
  );

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      requisitionId: requisition.id,
      provider: "NORDIGEN",
      status: "pending_auth",
    },
  });

  await createAuditLog(
    "BANK_REQUISITION_CREATED",
    { companyId, userId },
    { bankAccountId, requisitionId: requisition.id }
  );

  logger.info({ bankAccountId, requisitionId: requisition.id }, "[BANKING] Requisition erstellt");

  return { link: requisition.link };
}

// ── handleCallback ────────────────────────────────────────────────────────────

export async function handleCallback(ref: string): Promise<string> {
  const account = await prisma.bankAccount.findFirst({
    where: { requisitionId: ref },
    select: { id: true, companyId: true, iban: true, requisitionId: true },
  });

  if (!account) {
    logger.warn({ ref }, "[BANKING] Callback mit unbekannter requisitionId");
    throw new AppError(400, "Ungültiger oder abgelaufener Callback-Link");
  }

  const status = await nordigen.getRequisitionStatus(ref);

  if (status.status !== "LN") {
    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { status: "pending_auth" },
    });
    return env.NORDIGEN_REDIRECT_BASE + "/bank-accounts?status=pending";
  }

  if (status.accounts.length === 0) {
    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { status: "error" },
    });
    throw new AppError(502, "Nordigen-Requisition hat keine verknüpften Konten zurückgegeben");
  }

  // Find the Nordigen account that matches our IBAN
  let nordigenAccountId: string = status.accounts[0];
  let ibanMatched = false;

  for (const accId of status.accounts) {
    try {
      const details = await nordigen.getAccountDetails(accId);
      if (details.iban === account.iban) {
        nordigenAccountId = accId;
        ibanMatched = true;
        break;
      }
    } catch {
      // skip accounts we can't fetch
    }
  }

  if (!ibanMatched) {
    logger.warn(
      { bankAccountId: account.id },
      "[BANKING] IBAN-Match fehlgeschlagen, verwende erstes Nordigen-Konto als Fallback"
    );
  }

  await prisma.bankAccount.update({
    where: { id: account.id },
    data: {
      status: "connected",
      nordigenAccountId,
      lastSync: new Date(),
    },
  });

  await createAuditLog(
    "BANK_LINKED",
    { companyId: account.companyId },
    { bankAccountId: account.id, requisitionId: ref, nordigenAccountId }
  );

  logger.info(
    { bankAccountId: account.id, nordigenAccountId },
    "[BANKING] Bank-Konto verknüpft"
  );

  return env.NORDIGEN_REDIRECT_BASE + "/bank-accounts?status=linked";
}

// ── syncBankAccount ───────────────────────────────────────────────────────────

export async function syncBankAccount(
  companyId: number,
  bankAccountId: number
): Promise<{ synced: number }> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId, provider: "NORDIGEN" },
  });
  if (!account) throw new NotFoundError("BankAccount", bankAccountId);

  if (!account.nordigenAccountId) {
    throw new AppError(400, "nordigenAccountId nicht gesetzt — Bank-Konto noch nicht verknüpft");
  }

  const now = new Date();
  const fallbackFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const syncFrom: Date = account.lastSync ?? fallbackFrom;

  const dateFromStr = syncFrom.toISOString().slice(0, 10);
  const dateToStr = now.toISOString().slice(0, 10);

  const transactions = await nordigen.getTransactions(
    account.nordigenAccountId,
    dateFromStr,
    dateToStr
  );

  let synced = 0;

  for (const tx of transactions) {
    const amount = new Prisma.Decimal(tx.transactionAmount.amount);
    const remittanceInfo =
      tx.remittanceInformationUnstructured ??
      tx.remittanceInformationStructured ??
      "";

    // Upsert is idempotent: nordigenId has a @unique DB constraint.
    // Nordigen guarantees globally unique transactionIds, so cross-company collisions are not expected.
    // If a collision occurred, the first company's record would be created and subsequent companies
    // would only update remittanceInfo/creditorName/debtorName (not ownership or amount).
    await prisma.bankTransaction.upsert({
      where: { nordigenId: tx.transactionId },
      create: {
        nordigenId: tx.transactionId,
        bookingDate: new Date(tx.bookingDate),
        valueDate: tx.valueDate ? new Date(tx.valueDate) : null,
        amount,
        currency: tx.transactionAmount.currency,
        remittanceInfo,
        creditorName: tx.creditorName ?? null,
        creditorIban: tx.creditorAccount?.iban ?? null,
        debtorName: tx.debtorName ?? null,
        debtorIban: tx.debtorAccount?.iban ?? null,
        status: "UNMATCHED",
        bankAccountId,
        companyId,
      },
      update: {
        remittanceInfo,
        creditorName: tx.creditorName ?? null,
        debtorName: tx.debtorName ?? null,
      },
    });

    synced++;
  }

  await prisma.bankAccount.update({
    where: { id: bankAccountId },
    data: { lastSync: now, status: "connected" },
  });

  logger.info({ bankAccountId, synced }, "[BANKING] Sync abgeschlossen");

  return { synced };
}

// ── syncAllAccounts ───────────────────────────────────────────────────────────

export async function syncAllAccounts(): Promise<void> {
  const accounts = await prisma.bankAccount.findMany({
    where: {
      provider: "NORDIGEN",
      nordigenAccountId: { not: null },
      status: "connected",
    },
    select: { id: true, companyId: true },
  });

  logger.info({ count: accounts.length }, "[BANKING-SYNC] Starte automatischen Sync");

  for (const acc of accounts) {
    try {
      await syncBankAccount(acc.companyId, acc.id);
    } catch (err) {
      logger.error(
        { err, bankAccountId: acc.id, companyId: acc.companyId },
        "[BANKING-SYNC] Sync für Konto fehlgeschlagen"
      );
    }
  }
}

// ── listBankTransactions ──────────────────────────────────────────────────────

type MaskedBankTransaction = Omit<
  Awaited<ReturnType<typeof prisma.bankTransaction.findMany>>[number],
  "amount" | "creditorIban" | "debtorIban"
> & {
  amount: string;
  creditorIban: string | null;
  debtorIban: string | null;
};

export async function listBankTransactions(
  companyId: number,
  bankAccountId: number,
  params: { page: number; limit: number; status?: string }
): Promise<{
  data: MaskedBankTransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, companyId },
    select: { id: true },
  });
  if (!account) throw new NotFoundError("BankAccount", bankAccountId);

  const where: Prisma.BankTransactionWhereInput = {
    bankAccountId,
    companyId,
    ...(params.status ? { status: params.status as "UNMATCHED" | "MATCHED" | "IGNORED" } : {}),
  };

  const skip = (params.page - 1) * params.limit;

  const [rows, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      orderBy: { bookingDate: "desc" },
      skip,
      take: params.limit,
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  const masked = rows.map((tx) => ({
    ...tx,
    amount: tx.amount.toFixed(2),
    creditorIban: tx.creditorIban ? nordigen.maskIban(tx.creditorIban) : null,
    debtorIban: tx.debtorIban ? nordigen.maskIban(tx.debtorIban) : null,
  }));

  return {
    data: masked,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

// ── ignoreBankTransaction ─────────────────────────────────────────────────────

export async function ignoreBankTransaction(
  companyId: number,
  bankTransactionId: number
): Promise<void> {
  const tx = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, companyId, status: "UNMATCHED" },
    select: { id: true },
  });
  if (!tx) throw new NotFoundError("BankTransaction", bankTransactionId);

  await prisma.bankTransaction.update({
    where: { id: bankTransactionId, companyId },
    data: { status: "IGNORED" },
  });
}
