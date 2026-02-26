import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { createEmailAccountSchema, updateEmailAccountSchema } from "../schemas/email-account.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/email-account.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post("/", requireRole("ADMIN"), validate({ body: createEmailAccountSchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN"), validate({ params: idParamSchema, body: updateEmailAccountSchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN"), validate({ params: idParamSchema }), ctrl.remove);
router.post("/:id/sync", requireRole("ADMIN"), validate({ params: idParamSchema }), ctrl.syncNow);

export { router as emailAccountRouter };
