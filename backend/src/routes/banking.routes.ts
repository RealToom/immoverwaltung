import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  initiateRequisitionSchema,
  bankTransactionQuerySchema,
  listInstitutionsSchema,
} from "../schemas/banking.schema.js";
import * as ctrl from "../controllers/banking.controller.js";

const router = Router();

router.get(
  "/institutions",
  validate({ query: listInstitutionsSchema }),
  ctrl.listInstitutions
);

router.post(
  "/requisitions",
  requireRole("ADMIN", "VERWALTER"),
  validate({ body: initiateRequisitionSchema }),
  ctrl.initiateRequisition
);

router.get("/accounts/:id/status", ctrl.getAccountStatus);

router.post("/accounts/:id/sync", requireRole("ADMIN", "VERWALTER"), ctrl.syncAccount);

router.get(
  "/accounts/:id/transactions",
  validate({ query: bankTransactionQuerySchema }),
  ctrl.listTransactions
);

router.post(
  "/accounts/:id/transactions/:txId/ignore",
  requireRole("ADMIN", "VERWALTER"),
  ctrl.ignoreTransaction
);

router.post("/match", requireRole("ADMIN", "VERWALTER"), ctrl.runMatching);

export { router as bankingRouter };

// Named export for the public callback handler (mounted without auth in index.ts)
export { handleCallback as bankingCallbackHandler } from "../controllers/banking.controller.js";
