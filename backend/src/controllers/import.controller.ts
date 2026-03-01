// backend/src/controllers/import.controller.ts
import type { Request, Response } from "express";
import type { ZodIssue } from "zod";
import * as importService from "../services/import.service.js";
import {
  importPropertyRowsSchema,
  importTenantRowsSchema,
  importContractRowsSchema,
} from "../schemas/import.schema.js";
import { AppError } from "../lib/errors.js";

export async function importProperties(req: Request, res: Response): Promise<void> {
  const parsed = importPropertyRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e: ZodIssue) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importProperties(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}

export async function importTenants(req: Request, res: Response): Promise<void> {
  const parsed = importTenantRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e: ZodIssue) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importTenants(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}

export async function importContracts(req: Request, res: Response): Promise<void> {
  const parsed = importContractRowsSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((e: ZodIssue) => ({
      row: typeof e.path[0] === "number" ? e.path[0] + 1 : 0,
      field: e.path.slice(1).join("."),
      message: e.message,
    }));
    throw new AppError(400, "Validierungsfehler", { errors });
  }
  const result = await importService.importContracts(req.companyId!, parsed.data);
  res.status(201).json({ data: result });
}
