import type { Request, Response } from "express";
import * as svc from "../services/maintenance-schedule.service.js";

export async function list(req: Request, res: Response) {
  const propertyId = req.query.propertyId ? Number(req.query.propertyId) : undefined;
  res.json({ data: await svc.listSchedules(req.companyId!, propertyId) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await svc.createSchedule(req.companyId!, req.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await svc.updateSchedule(req.companyId!, Number(req.params.id), req.body) });
}

export async function remove(req: Request, res: Response) {
  await svc.deleteSchedule(req.companyId!, Number(req.params.id));
  res.json({ data: { success: true } });
}
