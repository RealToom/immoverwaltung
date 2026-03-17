import { Router } from "express";
import * as ctrl from "../controllers/billing.controller.js";

const router = Router();

router.get("/status", ctrl.getBillingStatus);
router.post("/checkout", ctrl.createCheckout);
router.post("/portal", ctrl.createPortal);

export { router as billingRouter };
