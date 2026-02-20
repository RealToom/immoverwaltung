import type { Request, Response } from "express";
import * as svc from "../services/email-account.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  res.json({ data: await svc.listAccounts(req.companyId!) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const account = await svc.createAccount(req.companyId!, req.body);
  res.status(201).json({ data: account });
}

export async function update(req: Request, res: Response): Promise<void> {
  const account = await svc.updateAccount(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: account });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await svc.deleteAccount(req.companyId!, Number(req.params.id));
  res.status(204).end();
}

export async function syncNow(req: Request, res: Response): Promise<void> {
  // Imports sync service (implemented in Task 5)
  const { syncAccount } = await import("../services/imap-sync.service.js");
  await syncAccount(Number(req.params.id), req.companyId!);
  res.json({ message: "Sync ausgelöst" });
}
