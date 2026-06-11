import type { Request, Response } from "express";
import * as bankService from "../services/bank.service.js";
import { BadRequestError } from "../lib/errors.js";

export async function list(req: Request, res: Response): Promise<void> {
    const accounts = await bankService.listBankAccounts(req.companyId!);
    res.json({ data: accounts });
}

export async function create(req: Request, res: Response): Promise<void> {
    const { name, iban, bic } = req.body;

    if (!name || !iban) {
        throw new BadRequestError("Name und IBAN sind erforderlich");
    }

    const account = await bankService.createBankAccount(req.companyId!, { name, iban, bic });
    res.status(201).json({ data: account });
}

export async function remove(req: Request, res: Response): Promise<void> {
    await bankService.deleteBankAccount(req.companyId!, Number(req.params.id));
    res.status(204).end();
}

export async function sync(req: Request, res: Response): Promise<void> {
    const account = await bankService.syncBankAccount(req.companyId!, Number(req.params.id));
    res.json({ data: account });
}

export async function importCsv(req: Request, res: Response): Promise<void> {
    // Body is validated by importTransactionsSchema (date parseable, amount finite, max 1000 rows)
    const { transactions } = req.body;
    const result = await bankService.importTransactions(req.companyId!, transactions);
    res.json({ data: result });
}
