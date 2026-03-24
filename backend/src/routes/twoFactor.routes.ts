import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireMfaToken } from "../middleware/requireMfaToken.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import {
  setup2faHandler,
  verifySetupHandler,
  verify2faHandler,
  regenerateBackupCodesHandler,
} from "../controllers/twoFactor.controller.js";

const router = Router();

// Setup flow (requires setupToken in X-MFA-Token header)
router.post("/2fa/setup", authLimiter, requireMfaToken("mfa_setup"), setup2faHandler);
router.post("/2fa/verify-setup", authLimiter, requireMfaToken("mfa_setup"), verifySetupHandler);

// Verify after login (requires mfaToken in X-MFA-Token header)
router.post("/verify-2fa", authLimiter, requireMfaToken("mfa_pending"), verify2faHandler);

// Regenerate backup codes (requires full auth — user must be logged in)
router.post("/2fa/regenerate-backup-codes", requireAuth, regenerateBackupCodesHandler);

export { router as twoFactorRouter };
