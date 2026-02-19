import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { contractQuerySchema, createContractSchema, updateContractSchema } from "../schemas/contract.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/contract.controller.js";

const router = Router();

router.get("/", validate({ query: contractQuerySchema }), ctrl.list);
router.get("/:id", validate({ params: idParamSchema }), ctrl.getById);
router.post("/", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ body: createContractSchema }), ctrl.create);
router.patch("/:id", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), validate({ params: idParamSchema, body: updateContractSchema }), ctrl.update);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), validate({ params: idParamSchema }), ctrl.remove);

export { router as contractRouter };
