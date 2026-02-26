import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  loginSchema,
  updateProfileSchema,
  updateNotificationPrefsSchema,
  changePasswordSchema,
} from "../schemas/auth.schema.js";
import {
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  getNotificationPrefsHandler,
  updateNotificationPrefsHandler,
  changePasswordHandler,
} from "../controllers/auth.controller.js";

const router = Router();

// Public routes (rate-limited)
// Self-registration is disabled — accounts are created by admins via /api/users
router.post("/login", authLimiter, validate({ body: loginSchema }), loginHandler);
router.post("/refresh", authLimiter, refreshHandler);

// Protected routes
router.post("/logout", requireAuth, logoutHandler);
router.get("/me", requireAuth, getMeHandler);
router.patch(
  "/me",
  requireAuth,
  validate({ body: updateProfileSchema }),
  updateMeHandler
);

router.get("/me/notifications", requireAuth, getNotificationPrefsHandler);
router.patch(
  "/me/notifications",
  requireAuth,
  validate({ body: updateNotificationPrefsSchema }),
  updateNotificationPrefsHandler
);

// Passwort ändern (rate-limited wie Login)
router.patch(
  "/me/password",
  requireAuth,
  authLimiter,
  validate({ body: changePasswordSchema }),
  changePasswordHandler
);

export { router as authRouter };
