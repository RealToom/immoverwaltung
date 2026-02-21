import type { Request, Response } from "express";
import * as svc from "../services/dunning.service.js";

export async function list(req: Request, res: Response) {
  const contractId = req.query.contractId ? Number(req.query.contractId) : undefined;
  res.json({ data: await svc.listDunning(req.companyId!, contractId) });
}

export async function send(req: Request, res: Response) {
  res.status(201).json({ data: await svc.sendDunning(req.companyId!, Number(req.params.contractId)) });
}

export async function resolve(req: Request, res: Response) {
  res.json({ data: await svc.resolveDunning(req.companyId!, Number(req.params.id)) });
}
