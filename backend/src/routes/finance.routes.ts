import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { financeQuerySchema, monthlyQuerySchema, createTransactionSchema, rentCollectionQuerySchema, updateTransactionSchema, utilityStatementQuerySchema, roiQuerySchema } from "../schemas/finance.schema.js";
import * as ctrl from "../controllers/finance.controller.js";

const router = Router();

router.get("/summary", ctrl.getSummary);
router.get("/monthly", validate({ query: monthlyQuerySchema }), ctrl.getMonthly);
router.get("/by-property", ctrl.getByProperty);
router.get("/expense-breakdown", ctrl.getExpenseBreakdown);
router.get("/transactions", validate({ query: financeQuerySchema }), ctrl.getTransactions);
router.post("/transactions", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ body: createTransactionSchema }), ctrl.createTransaction);
router.patch("/transactions/:id", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ body: updateTransactionSchema }), ctrl.patchTransaction);
router.get("/rent-collection", validate({ query: rentCollectionQuerySchema }), ctrl.getRentCollection);
router.get("/utility-statement", validate({ query: utilityStatementQuerySchema }), ctrl.getUtilityStatement);
router.get("/utility-statement/pdf", validate({ query: utilityStatementQuerySchema }), ctrl.utilityStatementPdf);
router.get("/roi", validate({ query: roiQuerySchema }), ctrl.getRoi);

export { router as financeRouter };
