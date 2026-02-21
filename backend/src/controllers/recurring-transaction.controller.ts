import type { Request, Response } from "express";
import * as svc from "../services/recurring-transaction.service.js";

export async function list(req: Request, res: Response) {
  const data = await svc.listRecurring(req.companyId!);
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await svc.createRecurring(req.companyId!, req.body);
  res.status(201).json({ data });
}

export async function update(req: Request, res: Response) {
  const data = await svc.updateRecurring(req.companyId!, Number(req.params.id), req.body);
  res.json({ data });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteRecurring(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
