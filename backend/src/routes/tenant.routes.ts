import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { tenantQuerySchema, createTenantSchema, updateTenantSchema } from "../schemas/tenant.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/tenant.controller.js";

const router = Router();

router.get("/", validate({ query: tenantQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", requireRole("ADMIN", "VERWALTER"), validate({ body: createTenantSchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema, body: updateTenantSchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { router as tenantRouter };
