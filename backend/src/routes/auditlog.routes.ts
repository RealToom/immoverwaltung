import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { getAuditLogs } from "../controllers/auditlog.controller.js";
import { auditLogQuerySchema } from "../schemas/auditlog.schema.js";

const router = Router();

router.get("/", requireRole("ADMIN"), validate({ query: auditLogQuerySchema }), getAuditLogs);

export { router as auditLogRouter };
