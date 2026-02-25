import type { Request, Response } from "express";
import * as datevService from "../services/datev.service.js";

// GET /finance/datev/settings
export async function getSettings(req: Request, res: Response): Promise<void> {
  const settings = await datevService.getOrCreateSettings(req.companyId!);
  res.json({ data: settings });
}

// PUT /finance/datev/settings
export async function putSettings(req: Request, res: Response): Promise<void> {
  const settings = await datevService.upsertSettings(req.companyId!, req.body);
  res.json({ data: settings });
}

// GET /finance/datev/mappings
export async function getMappings(req: Request, res: Response): Promise<void> {
  const mappings = await datevService.listMappings(req.companyId!);
  res.json({ data: mappings });
}

// PUT /finance/datev/mappings/:category
export async function putMapping(req: Request, res: Response): Promise<void> {
  const category = req.params.category as string;
  const { accountNumber } = req.body as { accountNumber: string };
  const mapping = await datevService.upsertMapping(req.companyId!, category, accountNumber);
  res.json({ data: mapping });
}

// POST /finance/datev/export
export async function exportCsv(req: Request, res: Response): Promise<void> {
  const { fromDate, toDate } = req.body as { fromDate: Date; toDate: Date };
  const { filename, buffer } = await datevService.generateExport(
    req.companyId!,
    fromDate,
    toDate,
    req.userId
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.send(buffer);
}
