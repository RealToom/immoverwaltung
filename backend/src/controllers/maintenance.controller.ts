import type { Request, Response } from "express";
import type { MaintenanceStatus, MaintenancePriority, MaintenanceCategory } from "@prisma/client";
import * as maintenanceService from "../services/maintenance.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await maintenanceService.listTickets(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    status: req.query.status as MaintenanceStatus | undefined,
    priority: req.query.priority as MaintenancePriority | undefined,
    category: req.query.category as MaintenanceCategory | undefined,
    propertyId: req.query.propertyId ? Number(req.query.propertyId) : undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const ticket = await maintenanceService.getTicket(req.companyId!, Number(req.params.id));
  res.json({ data: ticket });
}

export async function create(req: Request, res: Response): Promise<void> {
  const ticket = await maintenanceService.createTicket(req.companyId!, req.body);
  res.status(201).json({ data: ticket });
}

export async function update(req: Request, res: Response): Promise<void> {
  const ticket = await maintenanceService.updateTicket(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: ticket });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await maintenanceService.deleteTicket(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
