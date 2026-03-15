import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createMeterSchema, createMeterReadingSchema } from "../schemas/meter.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/meter.controller.js";

const scanUpload = multer({
  dest: "uploads/scan-tmp/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    cb(null, allowed.has(file.mimetype));
  },
});

const router = Router();

router.get("/", ctrl.list);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: createMeterSchema }), ctrl.create);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);
router.get("/:id/readings", validate({ params: idParamSchema }), ctrl.getReadings);
router.post("/:id/readings", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: createMeterReadingSchema }), ctrl.addReading);
router.delete("/:id/readings/:readingId", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  ctrl.removeReading);
router.post("/:id/scan", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema }), scanUpload.single("file"), ctrl.scanReading);

export { router as meterRouter };
