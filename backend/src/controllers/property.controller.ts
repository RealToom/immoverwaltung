import type { Request, Response } from "express";
import * as propertyService from "../services/property.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await propertyService.listProperties(req.companyId!, {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 25,
    search: (req.query.search as string) || "",
    status: req.query.status as "AKTIV" | "WARTUNG" | undefined,
  });
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const property = await propertyService.getProperty(req.companyId!, Number(req.params.id));
  res.json({ data: property });
}

export async function create(req: Request, res: Response): Promise<void> {
  const property = await propertyService.createProperty(req.companyId!, req.body);
  res.status(201).json({ data: property });
}

export async function update(req: Request, res: Response): Promise<void> {
  const property = await propertyService.updateProperty(req.companyId!, Number(req.params.id), req.body);
  res.json({ data: property });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await propertyService.deleteProperty(req.companyId!, Number(req.params.id));
  res.status(204).end();
}
