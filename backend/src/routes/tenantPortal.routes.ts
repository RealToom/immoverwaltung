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
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  get2faStatusHandler,
  enable2faHandler,
  confirm2faHandler,
  disable2faHandler,
} from "../controllers/tenantTwoFactor.controller.js";
import {
  confirm2faSchema,
  disable2faSchema,
} from "../schemas/tenantTwoFactor.schema.js";

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

// ─── 2FA Self-Service ──────────────────────────────────────────────────────────
router.get("/me/2fa/status", get2faStatusHandler);
router.post("/me/2fa/enable", authLimiter, enable2faHandler);
router.post("/me/2fa/confirm", authLimiter, validate({ body: confirm2faSchema }), confirm2faHandler);
router.delete("/me/2fa", validate({ body: disable2faSchema }), disable2faHandler);

export { router as tenantPortalRouter };
