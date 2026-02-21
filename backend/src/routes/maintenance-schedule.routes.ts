import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import { createScheduleSchema, updateScheduleSchema } from "../schemas/maintenance-schedule.schema.js";
import { idParamSchema } from "../schemas/common.schema.js";
import * as ctrl from "../controllers/maintenance-schedule.controller.js";

const router = Router();

router.get("/", ctrl.list);
router.post(
  "/",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ body: createScheduleSchema }),
  ctrl.create,
);
router.patch(
  "/:id",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema, body: updateScheduleSchema }),
  ctrl.update,
);
router.delete(
  "/:id",
  apiLimiter,
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: idParamSchema }),
  ctrl.remove,
);

export { router as maintenanceScheduleRouter };
