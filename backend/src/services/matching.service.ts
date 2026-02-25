import { Prisma } from "@prisma/client";
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

    await prisma.$transaction(async (tx) => {
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
    });

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
    } catch (err) {
      logger.error(
        { err, companyId },
        "[MATCHING] Fehler beim Matching für Firma"
      );
    }
  }
}
