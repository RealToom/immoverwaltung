import type { Request, Response } from "express";
import * as svc from "../services/tenantPortal.service.js";
import { BadRequestError } from "../lib/errors.js";

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
