import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const companyId = req.companyId ?? "unknown";

    // Determine storage path based on context:
    // - Property documents: /{companyId}/properties/{propertyId}/
    // - Tenant documents:   /{companyId}/tenants/{tenantId}/
    let dir: string;
    if (req.params.tenantId) {
      dir = path.join(env.UPLOAD_DIR, String(companyId), "tenants", String(req.params.tenantId));
    } else {
      const propertyId = req.params.propertyId ?? "general";
      dir = path.join(env.UPLOAD_DIR, String(companyId), "properties", String(propertyId));
    }

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Nicht unterstuetzter Dateityp. Erlaubt: PDF, DOCX, XLSX, JPG, PNG"));
  }
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");
