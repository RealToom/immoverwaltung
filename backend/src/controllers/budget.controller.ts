import type { Request, Response } from "express";
import * as svc from "../services/budget.service.js";

export async function list(req: Request, res: Response) {
  const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const data = await svc.listBudgets(req.companyId!, propertyId, year);
  res.json({ data });
}

export async function summary(req: Request, res: Response) {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const data = await svc.getBudgetSummary(req.companyId!, year);
  res.json({ data });
}

export async function upsert(req: Request, res: Response) {
  const data = await svc.upsertBudget(req.companyId!, req.body);
  res.status(200).json({ data });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteBudget(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
