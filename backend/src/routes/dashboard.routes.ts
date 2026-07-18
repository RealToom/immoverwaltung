import { Router } from "express";
import * as ctrl from "../controllers/dashboard.controller.js";
import { validate } from "../middleware/validate.js";
import { dashboardLayoutSchema } from "../schemas/dashboard.schema.js";

const router = Router();

router.get("/stats", ctrl.getStats);
router.get("/recent-activity", ctrl.getActivity);
router.get("/layout", ctrl.getLayout);
router.put("/layout", validate({ body: dashboardLayoutSchema }), ctrl.putLayout);
router.get("/revenue-series", ctrl.getRevenue);
router.get("/expiring-certificates", ctrl.getCertificates);

export { router as dashboardRouter };
