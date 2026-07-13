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
  utilityQuerySchema,
  createDisputeSchema,
} from "../schemas/tenantPortal.schema.js";
import { createMeterReadingSchema } from "../schemas/meter.schema.js";
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
router.get(
  "/documents/:id/download",
  validate({ params: tenantPortalIdParamSchema }),
  ctrl.downloadDocument
);

// ─── Uploads ──────────────────────────────────────────────────────────────────
router.get("/uploads", ctrl.getUploads);
router.post("/uploads", tenantUploadMiddleware, validate({ body: uploadMetaSchema }), ctrl.createUpload);

// ─── Tickets ──────────────────────────────────────────────────────────────────
router.get("/tickets", ctrl.getTickets);
router.post("/tickets", tenantPhotoMiddleware, validate({ body: createTicketSchema }), ctrl.createTicket);

// ─── Finances ─────────────────────────────────────────────────────────────────
router.get("/finances", ctrl.getFinances);

// ─── Utility Billing ────────────────────────────────────────────────────────────
router.get("/utility", validate({ query: utilityQuerySchema }), ctrl.getUtility);
router.get("/utility/receipts", validate({ query: utilityQuerySchema }), ctrl.getReceipts);
router.get(
  "/utility/receipts/:id/download",
  validate({ params: tenantPortalIdParamSchema }),
  ctrl.downloadReceipt
);
router.get("/meters", ctrl.getMeters);
router.post(
  "/meters/:id/readings",
  validate({ params: tenantPortalIdParamSchema, body: createMeterReadingSchema }),
  ctrl.addMeterReading
);
router.post("/meters/:id/readings/scan", tenantPhotoMiddleware, ctrl.scanMeterReadingPhoto);

// ─── Billing Disputes ─────────────────────────────────────────────────────────
router.post("/billing-disputes", validate({ body: createDisputeSchema }), ctrl.createDispute);
router.get("/billing-disputes", ctrl.getDisputes);

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get("/messages", ctrl.getMessages);
router.post("/messages", validate({ body: createMessageSchema }), ctrl.createMessage);

// ─── 2FA Self-Service ──────────────────────────────────────────────────────────
router.get("/me/2fa/status", get2faStatusHandler);
router.post("/me/2fa/enable", authLimiter, enable2faHandler);
router.post("/me/2fa/confirm", authLimiter, validate({ body: confirm2faSchema }), confirm2faHandler);
router.delete("/me/2fa", validate({ body: disable2faSchema }), disable2faHandler);

export { router as tenantPortalRouter };
