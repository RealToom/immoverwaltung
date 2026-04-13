import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { fileTypeFromFile } from "file-type";
import { BadRequestError } from "../lib/errors.js";
import { env } from "../config/env.js";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT));

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const companyId = req.companyId ?? "unknown";
    const tenantUserId = req.tenantUser?.id ?? "unknown";
    const dir = path.join(
      env.UPLOAD_DIR,
      String(companyId),
      "tenant-uploads",
      String(tenantUserId)
    );
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype] ?? ".bin";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Nicht unterstützter Dateityp. Erlaubt: PDF, JPG, PNG"));
  }
}

const multerUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });
const multerPhoto = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

/** Validates magic bytes of the uploaded file and deletes it on failure. */
async function validateMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.file) return next();

  const detected = await fileTypeFromFile(req.file.path);
  if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return next(new BadRequestError("Dateiinhalt entspricht nicht dem erlaubten Typ. Erlaubt: PDF, JPG, PNG"));
  }
  next();
}

export const tenantUploadMiddleware = [multerUpload.single("file"), validateMagicBytes];

/** Optional upload (for ticket photos) — wraps multer to not fail when no file */
export const tenantPhotoMiddleware = [multerPhoto.single("photo"), validateMagicBytes];
