import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updateNotificationPrefsSchema,
} from "../schemas/auth.schema.js";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  getMeHandler,
  updateMeHandler,
  getNotificationPrefsHandler,
  updateNotificationPrefsHandler,
} from "../controllers/auth.controller.js";

const router = Router();

// Public routes (rate-limited)
router.post("/register", authLimiter, validate({ body: registerSchema }), registerHandler);
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

export { router as authRouter };
