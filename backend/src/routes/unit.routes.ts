import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createUnitSchema, updateUnitSchema } from "../schemas/unit.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/unit.controller.js";

// Nested routes: /api/properties/:propertyId/units
const unitRouterNested = Router({ mergeParams: true });
unitRouterNested.get("/", ctrl.list);
unitRouterNested.post("/", requireRole("ADMIN", "VERWALTER"), validate({ body: createUnitSchema }), ctrl.create);

// Standalone routes: /api/units/:id
const unitRouter = Router();
unitRouter.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
unitRouter.patch("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema, body: updateUnitSchema }), ctrl.update);
unitRouter.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { unitRouterNested, unitRouter };
