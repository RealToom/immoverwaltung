import { Router } from "express";
import multer from "multer";
import { scanReceiptController } from "../controllers/receipt.controller.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const upload = multer({
  dest: "uploads/scan-tmp/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
    cb(null, allowed.has(file.mimetype));
  },
});

const router = Router();

router.post(
  "/scan",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  upload.single("file"),
  scanReceiptController,
);

export default router;
