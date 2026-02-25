import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { datevSettingsSchema, datevMappingSchema, datevExportSchema, datevMappingParamsSchema } from "../schemas/datev.schema.js";
import * as ctrl from "../controllers/datev.controller.js";

const router = Router();

router.get("/settings", requireRole("ADMIN"), ctrl.getSettings);

router.put(
  "/settings",
  requireRole("ADMIN"),
  validate({ body: datevSettingsSchema }),
  ctrl.putSettings
);

router.get("/mappings", requireRole("ADMIN"), ctrl.getMappings);

router.put(
  "/mappings/:category",
  requireRole("ADMIN"),
  validate({ params: datevMappingParamsSchema, body: datevMappingSchema.pick({ accountNumber: true }) }),
  ctrl.putMapping
);

router.post(
  "/export",
  requireRole("ADMIN", "BUCHHALTER"),
  validate({ body: datevExportSchema }),
  ctrl.exportCsv
);

export { router as datevRouter };
