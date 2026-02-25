import { Router } from "express";
import * as ctrl from "../controllers/report.controller.js";

const router = Router();

// GET /api/reports/export?format=csv|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/export", ctrl.exportReport);

export { router as reportRouter };
