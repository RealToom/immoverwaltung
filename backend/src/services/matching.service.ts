import { Prisma, BetrkvCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { createAuditLog } from "./audit.service.js";

/**
 * Vergleicht einen Bankbetrag mit der Vertragsmiete (Toleranz: ±0.01 EUR).
 */
export function amountsMatch(
  bankAmount: Prisma.Decimal,
  contractRent: number
): boolean {
  const tolerance = new Prisma.Decimal("0.01");
  const rent = new Prisma.Decimal(contractRent.toFixed(2));
  return bankAmount.minus(rent).abs().lte(tolerance);
}

/**
 * Bewertet die Übereinstimmung zwischen Verwendungszweck und Mietername.
 * Score 2 = alle Namensteile (>2 Zeichen) gefunden.
 */
export function scoreMatch(remittanceInfo: string, tenantName: string): number {
  let score = 0;
  const info = remittanceInfo.toLowerCase();
  const nameParts = tenantName
    .toLowerCase()
    .split(/\s+/)
    .filter((p) => p.length > 2);
  if (nameParts.length > 0 && nameParts.every((part) => info.includes(part))) {
    score += 2;
  }
  return score;
}

/**
 * Führt automatisches Matching für alle ungematchten BankTransactions
 * einer Firma durch.
 */
export async function matchPendingTransactions(
  companyId: number
): Promise<{ matched: number }> {
  const bankTxs = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      status: "UNMATCHED",
      amount: { gt: 0 },
    },
    orderBy: { bookingDate: "asc" },
  });

  if (bankTxs.length === 0) {
    return { matched: 0 };
  }

  const contracts = await prisma.contract.findMany({
    where: { companyId, status: "AKTIV" },
    include: { tenant: { select: { name: true } } },
  });

  let matched = 0;

  for (const bankTx of bankTxs) {
    // Schritt 1: Kandidaten nach Betrag filtern
    const amountCandidates = contracts.filter((c) =>
      amountsMatch(bankTx.amount, c.monthlyRent)
    );

    // Schritt 2: Score nach Verwendungszweck
    const scored = amountCandidates
      .map((contract) => ({
        contract,
        score: scoreMatch(bankTx.remittanceInfo, contract.tenant.name),
      }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      continue;
    }

    const best = scored[0].contract;
    const bookingMonth = new Date(
      bankTx.bookingDate.getFullYear(),
      bankTx.bookingDate.getMonth(),
      1
    );

    let didMatch = false;
    await prisma.$transaction(async (tx) => {
      // Optimistic lock: re-check status inside the transaction to prevent
      // double-matching if concurrent invocations race on the same BankTransaction.
      const current = await tx.bankTransaction.findUnique({
        where: { id: bankTx.id },
        select: { status: true },
      });
      if (!current || current.status !== "UNMATCHED") {
        return; // already matched by a concurrent call — skip
      }

      // RentPayment upserten
      const rentPayment = await tx.rentPayment.upsert({
        where: {
          contractId_month: {
            contractId: best.id,
            month: bookingMonth,
          },
        },
        create: {
          contractId: best.id,
          companyId,
          month: bookingMonth,
          amountDue: best.monthlyRent,
          amountPaid: Number(bankTx.amount.toFixed(2)),
          status: "PUENKTLICH",
          dueDate: new Date(
            bookingMonth.getFullYear(),
            bookingMonth.getMonth(),
            3
          ),
          paidDate: bankTx.bookingDate,
        },
        update: {
          amountPaid: { increment: Number(bankTx.amount.toFixed(2)) },
          status: "PUENKTLICH",
          paidDate: bankTx.bookingDate,
        },
      });

      // Ledger-Transaktion erstellen
      const ledgerTx = await tx.transaction.create({
        data: {
          date: bankTx.bookingDate,
          description:
            bankTx.remittanceInfo.slice(0, 500) ||
            "Miete " + best.tenant.name,
          type: "EINNAHME",
          amount: Number(bankTx.amount.toFixed(2)),
          category: "Miete",
          companyId,
          bankAccountId: bankTx.bankAccountId,
          propertyId: best.propertyId,
        },
      });

      // BankTransaction als MATCHED markieren
      await tx.bankTransaction.update({
        where: { id: bankTx.id },
        data: {
          status: "MATCHED",
          rentPaymentId: rentPayment.id,
          transactionId: ledgerTx.id,
        },
      });

      didMatch = true;
    });

    if (!didMatch) continue;

    // AuditLog außerhalb der DB-Transaktion (schlägt stumm fehl)
    await createAuditLog(
      "BANK_MATCH",
      { companyId },
      {
        bankTransactionId: bankTx.id,
        contractId: best.id,
        tenantName: best.tenant.name,
        amount: bankTx.amount.toFixed(2),
      }
    );

    logger.info(
      { bankTransactionId: bankTx.id, contractId: best.id },
      "[MATCHING] Transaktion gematcht"
    );

    matched++;
  }

  if (matched > 0) {
    logger.info(
      { companyId, matched },
      "[MATCHING] Automatisches Matching abgeschlossen"
    );
  }

  return { matched };
}

/**
 * Automatisches Matching für Nebenkosten-Versorger (Ausgaben).
 * Setzt allocatable = true und die passende BetrkvCategory.
 */
export async function matchUtilityTransactions(
  companyId: number
): Promise<{ matched: number }> {
  const bankTxs = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      status: "UNMATCHED",
      amount: { lt: 0 }, // Ausgaben sind meist negativ
    },
    orderBy: { bookingDate: "asc" },
  });

  if (bankTxs.length === 0) return { matched: 0 };

  // Bekannte Versorger-Muster
  const utilityRules = [
    { keywords: ["stadtwerke", "wasser", "energie"], category: BetrkvCategory.WASSERVERSORGUNG },
    { keywords: ["stadtkasse", "grundsteuer", "finanzamt"], category: BetrkvCategory.GRUNDSTEUER },
    { keywords: ["versicherung", "allianz", "axa"], category: BetrkvCategory.VERSICHERUNGEN },
    { keywords: ["müll", "awg", "entsorgung"], category: BetrkvCategory.STRASSENREINIGUNG_MUELL },
    { keywords: ["schornsteinfeger"], category: BetrkvCategory.SCHORNSTEINREINIGUNG }
  ];

  const properties = await prisma.property.findMany({
    where: { companyId, status: "AKTIV" },
    select: { id: true, name: true, street: true }
  });

  let matched = 0;

  for (const bankTx of bankTxs) {
    const textToMatch = [bankTx.creditorName, bankTx.remittanceInfo, bankTx.debtorName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // Regel-Engine auswerten
    let matchedCategory: BetrkvCategory | null = null;
    for (const rule of utilityRules) {
      if (rule.keywords.some((kw) => textToMatch.includes(kw))) {
        matchedCategory = rule.category;
        break;
      }
    }

    if (!matchedCategory) continue;

    // Immobilie finden (durch Straße oder Name im Verwendungszweck)
    let matchedPropertyId: number | null = null;
    if (properties.length === 1) {
      matchedPropertyId = properties[0].id;
    } else {
      for (const p of properties) {
        if (textToMatch.includes(p.street.toLowerCase()) || textToMatch.includes(p.name.toLowerCase())) {
          matchedPropertyId = p.id;
          break;
        }
      }
    }

    let didMatch = false;
    await prisma.$transaction(async (tx) => {
      const current = await tx.bankTransaction.findUnique({
        where: { id: bankTx.id },
        select: { status: true },
      });
      if (!current || current.status !== "UNMATCHED") return;

      const ledgerTx = await tx.transaction.create({
        data: {
          date: bankTx.bookingDate,
          description: bankTx.creditorName || "Versorgerabrechnung",
          type: "AUSGABE",
          amount: Number(Math.abs(Number(bankTx.amount)).toFixed(2)),
          category: "Nebenkosten",
          allocatable: true,
          betrkvCategory: matchedCategory,
          companyId,
          bankAccountId: bankTx.bankAccountId,
          propertyId: matchedPropertyId,
        },
      });

      await tx.bankTransaction.update({
        where: { id: bankTx.id },
        data: {
          status: "MATCHED",
          transactionId: ledgerTx.id,
        },
      });
      didMatch = true;
    });

    if (didMatch) matched++;
  }

  return { matched };
}

/**
 * Führt automatisches Matching für alle Firmen mit ungematchten Transaktionen durch.
 * Wird z.B. per Cron aufgerufen.
 */
export async function matchAllPendingTransactions(): Promise<void> {
  const companies = await prisma.bankTransaction.findMany({
    where: { status: "UNMATCHED", amount: { gt: 0 } },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  for (const { companyId } of companies) {
    try {
      await matchPendingTransactions(companyId);
      await matchUtilityTransactions(companyId);
    } catch (err) {
      logger.error(
        { err, companyId },
        "[MATCHING] Fehler beim Matching für Firma"
      );
    }
  }
}
