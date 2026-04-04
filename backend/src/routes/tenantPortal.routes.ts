import { Router } from "express";
import { requireTenantAuth } from "../middleware/tenantAuth.js";

// Tenant Portal API routes (all protected by requireTenantAuth)
// Populated by Tasks 8-14
const router = Router();

router.use(requireTenantAuth);

export { router as tenantPortalRouter };
