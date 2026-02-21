import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { dunningQuerySchema } from "../schemas/dunning.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/dunning.controller.js";

const router = Router();

router.get("/", validate({ query: dunningQuerySchema }), ctrl.list);
router.post("/contracts/:contractId/send", apiLimiter, requireRole("ADMIN", "VERWALTER"), ctrl.send);
router.patch("/:id/resolve", apiLimiter, requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }), ctrl.resolve);

export { router as dunningRouter };
