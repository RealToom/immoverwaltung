import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireTenantAuth } from "../middleware/tenantAuth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { tenantLoginSchema, tenantAcceptInviteSchema } from "../schemas/tenantAuth.schema.js";
import { verify2faSchema } from "../schemas/tenantTwoFactor.schema.js";
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  acceptInviteHandler,
} from "../controllers/tenantAuth.controller.js";
import { verify2faHandler } from "../controllers/tenantTwoFactor.controller.js";

const router = Router();

// POST /api/tenant/:slug/auth/login
router.post("/login", authLimiter, validate({ body: tenantLoginSchema }), loginHandler);

// POST /api/tenant/:slug/auth/verify-2fa
router.post("/verify-2fa", authLimiter, validate({ body: verify2faSchema }), verify2faHandler);

// POST /api/tenant/:slug/auth/refresh
router.post("/refresh", authLimiter, refreshHandler);

// POST /api/tenant/:slug/auth/logout
router.post("/logout", requireTenantAuth, logoutHandler);

// POST /api/tenant/:slug/auth/accept-invite
router.post("/accept-invite", authLimiter, validate({ body: tenantAcceptInviteSchema }), acceptInviteHandler);

export { router as tenantAuthRouter };
