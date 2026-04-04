import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

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

export const tenantUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

/** Optional upload (for ticket photos) — wraps multer to not fail when no file */
export const tenantPhotoMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("photo");
