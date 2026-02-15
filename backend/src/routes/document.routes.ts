import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createDocumentSchema } from "../schemas/document.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/document.controller.js";

// Nested routes: /api/properties/:propertyId/documents
const documentRouterNested = Router({ mergeParams: true });
documentRouterNested.get("/", ctrl.list);
documentRouterNested.post("/", requireRole("ADMIN", "VERWALTER"), validate({ body: createDocumentSchema }), ctrl.create);

// Standalone routes: /api/documents/:id
const documentRouter = Router();
documentRouter.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { documentRouterNested, documentRouter };
