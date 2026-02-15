import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { tenantGuard } from "../middleware/tenantGuard.js";
import { authRouter } from "./auth.routes.js";
import { propertyRouter } from "./property.routes.js";
import { unitRouter } from "./unit.routes.js";
import { tenantRouter } from "./tenant.routes.js";
import { contractRouter } from "./contract.routes.js";
import { maintenanceRouter } from "./maintenance.routes.js";
import { documentRouter } from "./document.routes.js";
import { financeRouter } from "./finance.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { companyRouter } from "./company.routes.js";

const router = Router();

// Public routes
router.use("/auth", authRouter);

// Protected routes (require auth + company isolation)
router.use("/properties", requireAuth, tenantGuard, propertyRouter);
router.use("/units", requireAuth, tenantGuard, unitRouter);
router.use("/tenants", requireAuth, tenantGuard, tenantRouter);
router.use("/contracts", requireAuth, tenantGuard, contractRouter);
router.use("/maintenance", requireAuth, tenantGuard, maintenanceRouter);
router.use("/documents", requireAuth, tenantGuard, documentRouter);
router.use("/finance", requireAuth, tenantGuard, financeRouter);
router.use("/dashboard", requireAuth, tenantGuard, dashboardRouter);
router.use("/company", requireAuth, tenantGuard, companyRouter);

export { router as apiRouter };
