import { prisma } from "../lib/prisma.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";

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

    for (const tx of transactions) {
        // skip if value is 0 or invalid
        if (!tx.amount || !tx.date) continue;

        // Find bank account by IBAN
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { companyId, iban: { contains: tx.iban, mode: "insensitive" } },
        });

        // Create transaction
        await prisma.transaction.create({
            data: {
                date: new Date(tx.date),
                description: tx.description,
                amount: tx.amount,
                type: tx.amount >= 0 ? "EINNAHME" : "AUSGABE",
                companyId,
                bankAccountId: bankAccount?.id, // Link if found, otherwise just company transaction
            },
        });

        // Update balance if account found
        if (bankAccount) {
            await prisma.bankAccount.update({
                where: { id: bankAccount.id },
                data: { balance: { increment: tx.amount } },
            });
        }

        importedCount++;
    }

    return { imported: importedCount };
}
