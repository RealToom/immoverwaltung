import type { Request, Response } from "express";
import fs from "fs";
import * as svc from "../services/tenantPortal.service.js";
import { BadRequestError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { scanMeterReading } from "../services/receipt.service.js";
import { decryptFile, getOriginalExt } from "../lib/crypto.js";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function sanitizeName(raw: string): string {
  return raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 255);
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response): Promise<void> {
  const data = await svc.getMe(req.tenantUser!);
  res.json({ data });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const data = await svc.updateMe(req.tenantUser!, req.body as { phone?: string; email?: string });
  res.json({ data });
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function getDocuments(req: Request, res: Response): Promise<void> {
  const data = await svc.getDocuments(req.tenantUser!);
  res.json({ data });
}

export async function signDocument(req: Request, res: Response): Promise<void> {
  const documentId = parseInt(req.params.id as string, 10);
  const { type, signatureData } = req.body as {
    type: "SIMPLE" | "SIGNATURE_PAD";
    signatureData?: string;
  };
  const data = await svc.signDocument(req.tenantUser!, documentId, type, signatureData);
  res.json({ data });
}

export async function downloadDocument(req: Request, res: Response): Promise<void> {
  const doc = await svc.downloadDocument(req.tenantUser!, Number(req.params.id));

  if (!doc.filePath) {
    res.status(400).json({ error: "Keine Datei vorhanden" });
    return;
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (doc.isEncrypted) {
    const decrypted = decryptFile(doc.filePath);
    const ext = getOriginalExt(doc.filePath);
    const mime = MIME_MAP[ext] || "application/octet-stream";
    const safeName = sanitizeName(doc.name);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", decrypted.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.send(decrypted);
    return;
  }

  res.download(doc.filePath, sanitizeName(doc.name));
}

// ─── Uploads ──────────────────────────────────────────────────────────────────

export async function getUploads(req: Request, res: Response): Promise<void> {
  const data = await svc.getUploads(req.tenantUser!);
  res.json({ data });
}

export async function createUpload(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new BadRequestError("Keine Datei hochgeladen");
  }
  const { category, description } = req.body as { category?: string; description?: string };
  const data = await svc.createUpload(req.tenantUser!, req.file, category ?? "Sonstiges", description);
  res.status(201).json({ data });
}

// ─── Tickets ──────────────────────────────────────────────────────────────────

export async function getTickets(req: Request, res: Response): Promise<void> {
  const data = await svc.getTickets(req.tenantUser!);
  res.json({ data });
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const data = await svc.createTicket(
    req.tenantUser!,
    req.body as { title: string; description: string; category: string },
    req.file?.path
  );
  res.status(201).json({ data });
}

// ─── Finances ─────────────────────────────────────────────────────────────────

export async function getFinances(req: Request, res: Response): Promise<void> {
  const data = await svc.getFinances(req.tenantUser!);
  res.json({ data });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response): Promise<void> {
  const data = await svc.getMessages(req.tenantUser!);
  res.json({ data });
}

export async function createMessage(req: Request, res: Response): Promise<void> {
  const { body } = req.body as { body: string };
  const data = await svc.createMessage(req.tenantUser!, body);
  res.status(201).json({ data });
}

// ─── Utility Billing ───────────────────────────────────────────────────────────

export async function getUtility(req: Request, res: Response): Promise<void> {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const data = await svc.getUtilitySummary(req.tenantUser!, year);
  res.json({ data });
}

export async function getMeters(req: Request, res: Response): Promise<void> {
  const data = await svc.getOwnMeters(req.tenantUser!);
  res.json({ data });
}

export async function addMeterReading(req: Request, res: Response): Promise<void> {
  const data = await svc.addOwnMeterReading(
    req.tenantUser!,
    Number(req.params.id),
    req.body as { value: number; readAt: string; note?: string }
  );
  res.status(201).json({ data });
}

export async function scanMeterReadingPhoto(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "Kein Foto hochgeladen" });
    return;
  }
  if (!env.ANTHROPIC_API_KEY) {
    fs.unlink(file.path, () => {});
    res.status(503).json({ error: "KI-Scan ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)" });
    return;
  }
  try {
    const data = await scanMeterReading(file.path, file.mimetype);
    res.json({ data });
  } finally {
    fs.unlink(file.path, () => {});
  }
}

// ─── Billing Disputes ─────────────────────────────────────────────────────────

export async function createDispute(req: Request, res: Response): Promise<void> {
  const data = await svc.createDispute(req.tenantUser!, req.body as { reason: string; amount?: number; year?: number });
  res.status(201).json({ data });
}

export async function getDisputes(req: Request, res: Response): Promise<void> {
  const data = await svc.getDisputes(req.tenantUser!);
  res.json({ data });
}
