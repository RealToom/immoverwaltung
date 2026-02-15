import type { Request, Response } from "express";
import * as unitService from "../services/unit.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const units = await unitService.listUnits(req.companyId!, Number(req.params.propertyId));
  res.json({ data: units });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const unit = await unitService.getUnit(req.companyId!, Number(req.params.id));
  res.json({ data: unit });
}

export async function create(req: Request, res: Response): Promise<void> {
  const unit = await unitService.createUnit(req.companyId!, Number(req.params.propertyId), req.body);
  res.status(201).json({ data: unit });
}

export async function update(req: Request, res: Response): Promise<void> {
  const unit = await unitService.updateUnit(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: unit });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await unitService.deleteUnit(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
