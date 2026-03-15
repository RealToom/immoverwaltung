import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createInsuranceSchema, updateInsuranceSchema, insuranceQuerySchema } from "../schemas/insurance.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/insurance.controller.js";

const router = Router();

router.get("/", validate({ query: insuranceQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: createInsuranceSchema }), ctrl.create);
router.patch("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema, body: updateInsuranceSchema }), ctrl.update);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);

export { router as insuranceRouter };
