import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createTemplateSchema, updateTemplateSchema } from "../schemas/document-template.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/document-template.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post(
  "/",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ body: createTemplateSchema }),
  ctrl.create,
);
router.patch(
  "/:id",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema, body: updateTemplateSchema }),
  ctrl.update,
);
router.delete(
  "/:id",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }),
  ctrl.remove,
);
router.post("/:id/render", apiLimiter, requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.renderToPdf);

export { router as documentTemplateRouter };
