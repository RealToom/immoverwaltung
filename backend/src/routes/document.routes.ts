import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { idParamSchema } from "../schemas/common.schema.js";
import { uploadMiddleware } from "../middleware/upload.js";
import * as ctrl from "../controllers/document.controller.js";

// Nested routes: /api/properties/:propertyId/documents
const documentRouterNested = Router({ mergeParams: true });
documentRouterNested.get("/", ctrl.list);
documentRouterNested.post("/", requireRole("ADMIN", "VERWALTER"), uploadMiddleware, ctrl.upload);

// Nested routes: /api/tenants/:tenantId/documents
const tenantDocumentRouter = Router({ mergeParams: true });
tenantDocumentRouter.get("/", ctrl.listByTenant);
tenantDocumentRouter.post("/", requireRole("ADMIN", "VERWALTER"), uploadMiddleware, ctrl.upload);

// Standalone routes: /api/documents/:id
const documentRouter = Router();
documentRouter.get("/:id/download", validate({ params: idParamSchema }), ctrl.download);
documentRouter.get("/:id/preview", validate({ params: idParamSchema }), ctrl.preview);
documentRouter.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { documentRouterNested, tenantDocumentRouter, documentRouter };
