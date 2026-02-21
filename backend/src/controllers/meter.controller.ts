import type { Request, Response } from "express";
import * as svc from "../services/meter.service.js";

export async function list(req: Request, res: Response) {
  const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
  const data = await svc.listMeters(req.companyId!, propertyId);
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await svc.createMeter(req.companyId!, req.body);
  res.status(201).json({ data });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteMeter(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}

export async function getReadings(req: Request, res: Response) {
  const data = await svc.listReadings(req.companyId!, Number(req.params.id));
  res.json({ data });
}

export async function addReading(req: Request, res: Response) {
  const data = await svc.addReading(req.companyId!, Number(req.params.id), req.body);
  res.status(201).json({ data });
}

export async function removeReading(req: Request, res: Response) {
  await svc.deleteReading(req.companyId!, Number(req.params.readingId));
  res.json({ data: { success: true } });
}
