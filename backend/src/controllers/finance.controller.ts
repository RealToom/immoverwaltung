import type { Request, Response } from "express";
import * as financeService from "../services/finance.service.js";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const summary = await financeService.getFinanceSummary(req.companyId!);
  res.json({ data: summary });
}

export async function getMonthly(req: Request, res: Response): Promise<void> {
  const months = Number(req.query.months) || 12;
  const data = await financeService.getMonthlyRevenue(req.companyId!, months);
  res.json({ data });
}

export async function getByProperty(req: Request, res: Response): Promise<void> {
  const data = await financeService.getRevenueByProperty(req.companyId!);
  res.json({ data });
}

export async function getTransactions(req: Request, res: Response): Promise<void> {
  const result = await financeService.listTransactions(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    type: req.query.type as "EINNAHME" | "AUSGABE" | undefined,
  });
  res.json(result);
}

export async function getExpenseBreakdown(req: Request, res: Response): Promise<void> {
  const data = await financeService.getExpenseBreakdown(req.companyId!);
  res.json({ data });
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  const transaction = await financeService.createTransaction(req.companyId!, req.body);
  res.status(201).json({ data: transaction });
}

export async function getRentCollection(req: Request, res: Response): Promise<void> {
  const months = Number(req.query.months) || 8;
  const data = await financeService.getRentCollection(req.companyId!, months);
  res.json({ data });
}
