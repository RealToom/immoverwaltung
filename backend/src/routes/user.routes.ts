import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { adminActionLimiter } from "../middleware/rateLimiter.js";
import { createUserSchema, updateUserSchema } from "../schemas/user.schema.js";
import * as ctrl from "../controllers/user.controller.js";

const router = Router();

// List all users — ADMIN + VERWALTER can view
router.get("/", requireRole("ADMIN", "VERWALTER"), ctrl.getUsers);

// Create user — ADMIN only
router.post("/", requireRole("ADMIN"), validate({ body: createUserSchema }), ctrl.createUser);

// Update user — ADMIN only
router.patch("/:id", requireRole("ADMIN"), validate({ body: updateUserSchema }), ctrl.updateUser);

// Delete user — ADMIN only
router.delete("/:id", requireRole("ADMIN"), ctrl.deleteUser);

// Reset password — ADMIN only (strict rate limit: 5 req/15min)
router.post("/:id/reset-password", requireRole("ADMIN"), adminActionLimiter, ctrl.resetPassword);

// Unlock user — ADMIN only (strict rate limit: 5 req/15min)
router.post("/:id/unlock", requireRole("ADMIN"), adminActionLimiter, ctrl.unlockUser);

export { router as userRouter };
