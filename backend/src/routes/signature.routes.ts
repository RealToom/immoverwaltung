import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/signature.controller.js";

// mergeParams: true so ":id" from the parent contract route is accessible
const router = Router({ mergeParams: true });

router.post(
  "/",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }),
  ctrl.sendForSignature,
);
router.get("/", validate({ params: idParamSchema }), ctrl.getSignatureStatus);
router.get("/document", validate({ params: idParamSchema }), ctrl.downloadSignedDocument);

export { router as signatureRouter };
