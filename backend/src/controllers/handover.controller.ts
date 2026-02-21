import type { Request, Response } from "express";
import * as svc from "../services/handover.service.js";

export async function list(req: Request, res: Response) {
  const unitId = req.query.unitId ? Number(req.query.unitId) : undefined;
  res.json({ data: await svc.listHandovers(req.companyId!, unitId) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createHandover(req.companyId!, req.body) });
}

export async function getById(req: Request, res: Response) {
  res.json({ data: await svc.getHandover(req.companyId!, Number(req.params.id)) });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteHandover(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
