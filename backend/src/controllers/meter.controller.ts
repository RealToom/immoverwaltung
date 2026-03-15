import type { Request, Response } from "express";
import fs from "fs";
import * as svc from "../services/meter.service.js";
import { scanMeterReading } from "../services/receipt.service.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

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

export async function scanReading(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Keine Datei hochgeladen" });
    return;
  }

  if (!env.ANTHROPIC_API_KEY) {
    fs.unlink(file.path, () => {});
    res.status(503).json({ error: "KI-Scan ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)" });
    return;
  }

  try {
    const result = await scanMeterReading(file.path, file.mimetype);
    res.json({ data: result });
  } catch (err) {
    logger.error({ errorMessage: err instanceof Error ? err.message : "Unknown" }, "KI-Zähler-Scan fehlgeschlagen");
    res.status(502).json({ error: "KI-Scan fehlgeschlagen. Bitte erneut versuchen." });
  } finally {
    fs.unlink(file.path, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== "ENOENT") {
        logger.warn({ err: unlinkErr, path: file.path }, "Temporäre Scan-Datei konnte nicht gelöscht werden");
      }
    });
  }
}
