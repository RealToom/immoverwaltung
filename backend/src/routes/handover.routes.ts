import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createHandoverSchema } from "../schemas/handover.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/handover.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: createHandoverSchema }), ctrl.create);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);

export { router as handoverRouter };
