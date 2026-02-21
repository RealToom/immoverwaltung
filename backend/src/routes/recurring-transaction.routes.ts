import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createRecurringSchema, updateRecurringSchema } from "../schemas/recurring-transaction.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/recurring-transaction.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: createRecurringSchema }), ctrl.create);
router.patch("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: updateRecurringSchema }), ctrl.update);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);

export { router as recurringTransactionRouter };
