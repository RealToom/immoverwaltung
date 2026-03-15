import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/budget.controller.js";

const upsertBudgetSchema = z.object({
  propertyId: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  plannedAmount: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});

const router = Router();

router.get("/", ctrl.list);
router.get("/summary", ctrl.summary);
router.post("/", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ body: upsertBudgetSchema }), ctrl.upsert);
router.delete("/:id", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.remove);

export { router as budgetRouter };
