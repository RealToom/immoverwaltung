import type { Request, Response } from "express";
import * as tenantService from "../services/tenant.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await tenantService.listTenants(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    propertyId: req.query.propertyId ? Number(req.query.propertyId) : undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const tenant = await tenantService.getTenant(req.companyId!, Number(req.params.id));
  res.json({ data: tenant });
}

export async function create(req: Request, res: Response): Promise<void> {
  const tenant = await tenantService.createTenant(req.companyId!, req.body);
  res.status(201).json({ data: tenant });
}

export async function update(req: Request, res: Response): Promise<void> {
  const tenant = await tenantService.updateTenant(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: tenant });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await tenantService.deleteTenant(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
