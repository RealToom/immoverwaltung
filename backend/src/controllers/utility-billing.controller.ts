import type { Request, Response } from "express";
import { UtilityBillingService } from "../services/utility-billing.service.js";
import * as disputeSvc from "../services/billing-dispute.service.js";
import type { DisputeStatus } from "../services/billing-dispute.service.js";

export async function generateStatement(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = req.body as { propertyId: number; year: number };
  const svc = new UtilityBillingService(req.companyId!);
  const [statement, unallocatedTransactions] = await Promise.all([
    svc.generateStatement(propertyId, year),
    svc.listUnallocatedTransactions(propertyId, year),
  ]);
  res.json({ data: { ...statement, unallocatedTransactions } });
}

export async function finalizeStatement(req: Request, res: Response): Promise<void> {
  const { propertyId, year } = req.body as { propertyId: number; year: number };
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.finalizeStatement(propertyId, year);
  res.json({ data });
}

export async function setDistributionKeys(req: Request, res: Response): Promise<void> {
  const { costConfiguration } = req.body as { costConfiguration: Record<string, string> };
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.setDistributionKeys(Number(req.params.id), costConfiguration);
  res.json({ data });
}

export async function applyPrepaymentAdjustment(req: Request, res: Response): Promise<void> {
  const { utilityPrepayment } = req.body as { utilityPrepayment: number };
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.applyPrepaymentAdjustment(Number(req.params.id), utilityPrepayment);
  res.json({ data });
}

export async function getStatementDeadlines(req: Request, res: Response): Promise<void> {
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.getStatementDeadlines();
  res.json({ data });
}

export async function listStatements(req: Request, res: Response): Promise<void> {
  const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.listStatements(propertyId, year);
  res.json({ data });
}

export async function getStatement(req: Request, res: Response): Promise<void> {
  const svc = new UtilityBillingService(req.companyId!);
  const data = await svc.getStatement(Number(req.params.id));
  res.json({ data });
}

export async function listDisputes(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const data = await disputeSvc.listDisputesByCompany(req.companyId!, status);
  res.json({ data });
}

export async function updateDisputeStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: DisputeStatus };
  const data = await disputeSvc.updateDisputeStatus(req.companyId!, Number(req.params.id), status);
  res.json({ data });
}
