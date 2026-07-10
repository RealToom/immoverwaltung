import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { idParamSchema } from "../schemas/common.schema.js";
import {
  generateStatementSchema,
  listDisputesQuerySchema,
  updateDisputeStatusSchema,
} from "../schemas/utility-billing.schema.js";
import * as ctrl from "../controllers/utility-billing.controller.js";

const router = Router();

router.post(
  "/statements/generate",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: generateStatementSchema }),
  ctrl.generateStatement
);
router.post(
  "/statements/finalize",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ body: generateStatementSchema }),
  ctrl.finalizeStatement
);
router.get("/disputes", validate({ query: listDisputesQuerySchema }), ctrl.listDisputes);
router.patch(
  "/disputes/:id",
  requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: updateDisputeStatusSchema }),
  ctrl.updateDisputeStatus
);

export { router as utilityBillingRouter };
