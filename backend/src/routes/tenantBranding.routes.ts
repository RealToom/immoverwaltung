import { Router } from "express";
import { getBrandingHandler } from "../controllers/tenantBranding.controller.js";

const router = Router();

// GET /api/tenant/company/:slug  (public — no auth needed)
router.get("/:slug", getBrandingHandler);

export { router as tenantBrandingRouter };
