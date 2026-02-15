import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { financeQuerySchema, monthlyQuerySchema, createTransactionSchema, rentCollectionQuerySchema } from "../schemas/finance.schema.js";
import * as ctrl from "../controllers/finance.controller.js";

const router = Router();

router.get("/summary", ctrl.getSummary);
router.get("/monthly", validate({ query: monthlyQuerySchema }), ctrl.getMonthly);
router.get("/by-property", ctrl.getByProperty);
router.get("/expense-breakdown", ctrl.getExpenseBreakdown);
router.get("/transactions", validate({ query: financeQuerySchema }), ctrl.getTransactions);
router.post("/transactions", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ body: createTransactionSchema }), ctrl.createTransaction);
router.get("/rent-collection", validate({ query: rentCollectionQuerySchema }), ctrl.getRentCollection);

export { router as financeRouter };
