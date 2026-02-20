import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

// Whitelist: MIME-Typ → sichere Dateiendung (nie vom Client übernehmen)
const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

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
    // Immer sichere Endung aus MIME-Whitelist verwenden — nie vom Client übernehmen
    const ext = MIME_TO_EXT[file.mimetype] ?? ".bin";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (MIME_TO_EXT[file.mimetype]) {
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
