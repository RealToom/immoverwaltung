import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createPropertySchema, updatePropertySchema, propertyQuerySchema } from "../schemas/property.schema.js";
import { idParamSchema, propertyIdParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/property.controller.js";
import { unitRouterNested } from "./unit.routes.js";
import { documentRouterNested } from "./document.routes.js";

const router = Router();

router.get("/", validate({ query: propertyQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", requireRole("ADMIN", "VERWALTER"), validate({ body: createPropertySchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema, body: updatePropertySchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

// Nested: /api/properties/:propertyId/units
router.use("/:propertyId/units", validate({ params: propertyIdParamSchema }), unitRouterNested);

// Nested: /api/properties/:propertyId/documents
router.use("/:propertyId/documents", validate({ params: propertyIdParamSchema }), documentRouterNested);

export { router as propertyRouter };
