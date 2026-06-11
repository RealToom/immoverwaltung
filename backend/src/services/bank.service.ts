import { prisma } from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import { createAuditLog } from "./audit.service.js";

function maskIban(iban: string): string {
  if (iban.length < 8) return "****";
  return iban.slice(0, 4) + "****" + iban.slice(-4);
}

export async function listBankAccounts(companyId: number) {
    const accounts = await prisma.bankAccount.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
    });
    return accounts.map((a) => ({ ...a, iban: maskIban(a.iban) }));
}

export async function getBankAccount(companyId: number, id: number) {
    const account = await prisma.bankAccount.findFirst({
        where: { id, companyId },
    });

    if (!account) throw new NotFoundError("Bankkonto", id);
    return { ...account, iban: maskIban(account.iban) };
}

export async function createBankAccount(companyId: number, data: { name: string; iban: string; bic?: string }) {
    return prisma.bankAccount.create({
        data: {
            ...data,
            companyId,
            balance: 0,
            status: "connected",
            lastSync: new Date(),
        },
    });
}

export async function deleteBankAccount(companyId: number, id: number) {
    const account = await prisma.bankAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundError("Bankkonto", id);

    return prisma.bankAccount.delete({ where: { id } });
}

export async function syncBankAccount(companyId: number, id: number) {
    const account = await prisma.bankAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundError("Bankkonto", id);

    // Mock implementation: update lastSync and maybe simulate a balance change
    return prisma.bankAccount.update({
        where: { id },
        data: {
            lastSync: new Date(),
            status: "connected",
        },
    });
}

interface CsvTransaction {
    date: string;
    description: string;
    amount: number;
    iban: string; // To match with bank account
}

export async function importTransactions(companyId: number, transactions: CsvTransaction[]) {
    let importedCount = 0;

    // Resolve account links via exact IBAN match only — a substring/empty match must
    // never credit a different account than the one in the CSV row.
    const accounts = await prisma.bankAccount.findMany({
        where: { companyId },
        select: { id: true, iban: true },
    });
    const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();
    const accountByIban = new Map(accounts.map((a) => [normalizeIban(a.iban), a.id]));

    // Single DB transaction: either the whole import succeeds or nothing is written
    await prisma.$transaction(
        async (tx) => {
            for (const row of transactions) {
                // skip if value is 0 or invalid
                if (!row.amount || !row.date) continue;

                const bankAccountId = row.iban
                    ? accountByIban.get(normalizeIban(row.iban))
                    : undefined;

                await tx.transaction.create({
                    data: {
                        date: new Date(row.date),
                        description: row.description,
                        amount: row.amount,
                        type: row.amount >= 0 ? "EINNAHME" : "AUSGABE",
                        companyId,
                        bankAccountId, // Link if IBAN matches exactly, otherwise just company transaction
                    },
                });

                if (bankAccountId) {
                    await tx.bankAccount.update({
                        where: { id: bankAccountId },
                        data: { balance: { increment: row.amount } },
                    });
                }

                importedCount++;
            }
        },
        { timeout: 30000 }
    );

    await createAuditLog("BANK_CSV_IMPORT", { companyId }, {
        rows: transactions.length,
        imported: importedCount,
    });

    return { imported: importedCount };
}
