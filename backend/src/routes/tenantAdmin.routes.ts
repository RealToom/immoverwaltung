import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { adminReplyToTenant, adminGetTenantMessages } from "../services/tenantPortal.service.js";
import { adminReset2faHandler } from "../controllers/tenantTwoFactor.controller.js";

export const tenantAdminRouter = Router();

const tenantUserIdParam = z.object({ tenantUserId: z.coerce.number().int().positive() });
const replyBody = z.object({ body: z.string().min(1).max(5000) });

// GET /api/tenant-admin/messages/:tenantUserId
tenantAdminRouter.get(
  "/messages/:tenantUserId",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: tenantUserIdParam }),
  async (req, res) => {
    const messages = await adminGetTenantMessages(
      req.companyId!,
      parseInt(req.params.tenantUserId as string, 10)
    );
    res.json({ data: messages });
  }
);

// POST /api/tenant-admin/messages/:tenantUserId
tenantAdminRouter.post(
  "/messages/:tenantUserId",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: tenantUserIdParam, body: replyBody }),
  async (req, res) => {
    const msg = await adminReplyToTenant(
      req.companyId!,
      parseInt(req.params.tenantUserId as string, 10),
      (req.body as { body: string }).body
    );
    res.status(201).json({ data: msg });
  }
);

// DELETE /api/tenant-admin/tenants/:tenantUserId/2fa
tenantAdminRouter.delete(
  "/tenants/:tenantUserId/2fa",
  requireRole("ADMIN", "VERWALTER"),
  validate({ params: tenantUserIdParam }),
  adminReset2faHandler
);
