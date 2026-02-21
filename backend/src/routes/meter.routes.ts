import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createMeterSchema, createMeterReadingSchema } from "../schemas/meter.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/meter.controller.js";

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

export { router as meterRouter };
