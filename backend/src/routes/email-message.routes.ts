import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { emailMessageQuerySchema, updateEmailMessageSchema,
         replyEmailSchema, sendDocumentSchema, createEventFromEmailSchema } from "../schemas/email-message.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/email-message.controller.js";

const router = Router();

router.get("/", validate({ query: emailMessageQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.patch("/:id", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: updateEmailMessageSchema }), ctrl.update);
router.post("/:id/reply", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: replyEmailSchema }), ctrl.reply);
router.post("/:id/send-document", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: sendDocumentSchema }), ctrl.sendDocument);
router.post("/:id/create-event", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"),
  validate({ params: idParamSchema, body: createEventFromEmailSchema }), ctrl.createEvent);

export { router as emailMessageRouter };
