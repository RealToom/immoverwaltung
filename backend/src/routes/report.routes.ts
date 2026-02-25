import { Router } from "express";
import * as ctrl from "../controllers/report.controller.js";
import { validate } from "../middleware/validate.js";
import { reportExportQuerySchema } from "../schemas/report.schema.js";

const router = Router();

// GET /api/reports/export?format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/export", validate({ query: reportExportQuerySchema }), ctrl.exportReport);

export { router as reportRouter };
