// backend/src/routes/superadmin.routes.ts
import { Router } from "express";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin.js";
import * as ctrl from "../controllers/superadmin.controller.js";

const router = Router();

router.post("/login", ctrl.login);
router.get("/stats", requireSuperAdmin, ctrl.getStats);
router.get("/companies", requireSuperAdmin, ctrl.getCompanies);
router.post("/companies", requireSuperAdmin, ctrl.createCompany);
router.post("/companies/:id/reset-password", requireSuperAdmin, ctrl.resetPassword);
router.delete("/companies/:id", requireSuperAdmin, ctrl.deleteCompany);

export { router as superadminRouter };
