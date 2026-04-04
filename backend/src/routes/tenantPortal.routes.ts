import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireTenantAuth } from "../middleware/tenantAuth.js";
import { tenantUploadMiddleware, tenantPhotoMiddleware } from "../middleware/tenantUpload.js";
import {
  tenantPortalIdParamSchema,
  updateMeSchema,
  createTicketSchema,
  createMessageSchema,
  signDocumentSchema,
  uploadMetaSchema,
} from "../schemas/tenantPortal.schema.js";
import * as ctrl from "../controllers/tenantPortal.controller.js";

const router = Router({ mergeParams: true });

// All routes require a valid TENANT JWT
router.use(requireTenantAuth);

// ─── Me ───────────────────────────────────────────────────────────────────────
router.get("/me", ctrl.getMe);
router.patch("/me", validate({ body: updateMeSchema }), ctrl.updateMe);

// ─── Documents ────────────────────────────────────────────────────────────────
router.get("/documents", ctrl.getDocuments);
router.post(
  "/documents/:id/sign",
  validate({ params: tenantPortalIdParamSchema, body: signDocumentSchema }),
  ctrl.signDocument
);

// ─── Uploads ──────────────────────────────────────────────────────────────────
router.get("/uploads", ctrl.getUploads);
router.post("/uploads", tenantUploadMiddleware, validate({ body: uploadMetaSchema }), ctrl.createUpload);

// ─── Tickets ──────────────────────────────────────────────────────────────────
router.get("/tickets", ctrl.getTickets);
router.post("/tickets", tenantPhotoMiddleware, validate({ body: createTicketSchema }), ctrl.createTicket);

// ─── Finances ─────────────────────────────────────────────────────────────────
router.get("/finances", ctrl.getFinances);

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get("/messages", ctrl.getMessages);
router.post("/messages", validate({ body: createMessageSchema }), ctrl.createMessage);

export { router as tenantPortalRouter };
