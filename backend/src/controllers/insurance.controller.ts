import type { Request, Response } from "express";
import * as svc from "../services/insurance.service.js";

export async function list(req: Request, res: Response) {
  const result = await svc.listInsurancePolicies(req.companyId!, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    propertyId: req.query.propertyId ? Number(req.query.propertyId) : undefined,
    type: req.query.type as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response) {
  const data = await svc.getInsurancePolicy(req.companyId!, Number(req.params.id));
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await svc.createInsurancePolicy(req.companyId!, req.body);
  res.status(201).json({ data });
}

export async function update(req: Request, res: Response) {
  const data = await svc.updateInsurancePolicy(req.companyId!, Number(req.params.id), req.body);
  res.json({ data });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteInsurancePolicy(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
