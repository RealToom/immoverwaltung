import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/stats", ctrl.getStats);
router.get("/recent-activity", ctrl.getActivity);

export { router as dashboardRouter };
