import path from "node:path";
import type { Request, Response } from "express";
import * as documentService from "../services/document.service.js";
import { BadRequestError } from "../lib/errors.js";
import { decryptFile, getOriginalExt } from "../lib/crypto.js";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// ─── DSGVO Audit Log ──────────────────────────────────────────
function auditLog(action: string, req: Request, details: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    userId: req.user?.id,
    companyId: req.companyId,
    ip: req.ip,
    ...details,
  };
  // Structured log for audit trail (Art. 5 DSGVO - Nachweisbarkeit)
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}

export async function list(req: Request, res: Response): Promise<void> {
  const documents = await documentService.listDocuments(req.companyId!, Number(req.params.propertyId));
  res.json({ data: documents });
}

export async function listByTenant(req: Request, res: Response): Promise<void> {
  const documents = await documentService.listTenantDocuments(req.companyId!, Number(req.params.tenantId));
  res.json({ data: documents });
}

export async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new BadRequestError("Keine Datei hochgeladen");
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const name = (req.body.name as string) || req.file.originalname;

  const propertyId = req.params.propertyId ? Number(req.params.propertyId) : undefined;
  const tenantId = req.params.tenantId ? Number(req.params.tenantId) : undefined;

  // DSGVO Art. 17 - Optional retention period from request body
  let retentionUntil: Date | null = null;
  if (req.body.retentionMonths) {
    const months = Number(req.body.retentionMonths);
    if (months > 0) {
      retentionUntil = new Date();
      retentionUntil.setMonth(retentionUntil.getMonth() + months);
    }
  }

  const doc = await documentService.createDocument(req.companyId!, {
    name,
    fileType: ext.replace(".", "").toUpperCase(),
    fileSize: formatFileSize(req.file.size),
    filePath: req.file.path,
    propertyId,
    tenantId,
    retentionUntil,
  });

  auditLog("DOCUMENT_UPLOAD", req, {
    documentId: doc.id,
    documentName: doc.name,
    propertyId,
    tenantId,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    retentionUntil: retentionUntil?.toISOString() ?? null,
    encrypted: doc.isEncrypted,
  });

  res.status(201).json({ data: doc });
}

export async function download(req: Request, res: Response): Promise<void> {
  const doc = await documentService.getDocument(req.companyId!, Number(req.params.id));

  if (!doc.filePath) {
    throw new BadRequestError("Keine Datei vorhanden");
  }

  auditLog("DOCUMENT_DOWNLOAD", req, {
    documentId: doc.id,
    documentName: doc.name,
  });

  // Handle encrypted files - decrypt in memory, stream to response
  if (doc.isEncrypted) {
    const decrypted = decryptFile(doc.filePath);
    const ext = getOriginalExt(doc.filePath);
    const mime = MIME_MAP[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.name}"`);
    res.send(decrypted);
    return;
  }

  res.download(doc.filePath, doc.name);
}

export async function preview(req: Request, res: Response): Promise<void> {
  const doc = await documentService.getDocument(req.companyId!, Number(req.params.id));

  if (!doc.filePath) {
    throw new BadRequestError("Keine Datei vorhanden");
  }

  auditLog("DOCUMENT_PREVIEW", req, {
    documentId: doc.id,
    documentName: doc.name,
  });

  // Handle encrypted files - decrypt in memory, stream to response
  if (doc.isEncrypted) {
    const decrypted = decryptFile(doc.filePath);
    const ext = getOriginalExt(doc.filePath);
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${doc.name}"`);
    res.send(decrypted);
    return;
  }

  const ext = path.extname(doc.filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${doc.name}"`);
  res.sendFile(path.resolve(doc.filePath));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const docId = Number(req.params.id);
  auditLog("DOCUMENT_DELETE", req, { documentId: docId });
  await documentService.deleteDocument(req.companyId!, docId);
  res.status(204).end();
}
