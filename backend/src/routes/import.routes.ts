// backend/src/routes/import.routes.ts
import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as ctrl from "../controllers/import.controller.js";

const router = Router();

router.post("/properties", requireRole("ADMIN", "VERWALTER"), ctrl.importProperties);
router.post("/tenants", requireRole("ADMIN", "VERWALTER"), ctrl.importTenants);
router.post("/contracts", requireRole("ADMIN", "VERWALTER"), ctrl.importContracts);

export { router as importRouter };
