import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireTenantAuth } from "../middleware/tenantAuth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { tenantLoginSchema, tenantAcceptInviteSchema } from "../schemas/tenantAuth.schema.js";
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  acceptInviteHandler,
} from "../controllers/tenantAuth.controller.js";

const router = Router();

// POST /api/tenant/:slug/auth/login
router.post("/login", authLimiter, validate({ body: tenantLoginSchema }), loginHandler);

// POST /api/tenant/:slug/auth/refresh
router.post("/refresh", authLimiter, refreshHandler);

// POST /api/tenant/:slug/auth/logout (requires auth)
router.post("/logout", requireTenantAuth, logoutHandler);

// POST /api/tenant/:slug/auth/accept-invite
router.post("/accept-invite", authLimiter, validate({ body: tenantAcceptInviteSchema }), acceptInviteHandler);

export { router as tenantAuthRouter };
