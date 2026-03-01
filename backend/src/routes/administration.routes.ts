import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { adminActionLimiter } from "../middleware/rateLimiter.js";
import {
  putSmtpSchema,
  createRoleSchema,
  updateRoleSchema,
  setUserCustomRoleSchema,
} from "../schemas/administration.schema.js";
import {
  getSmtpHandler,
  putSmtpHandler,
  testSmtpHandler,
  getRolesHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  setUserCustomRoleHandler,
} from "../controllers/administration.controller.js";

const router = Router();

// All routes are ADMIN-only
router.use(requireRole("ADMIN"));

// SMTP
router.get("/smtp", getSmtpHandler);
router.put("/smtp", validate({ body: putSmtpSchema }), putSmtpHandler);
router.post("/smtp/test", adminActionLimiter, testSmtpHandler);

// Custom Roles
router.get("/roles", getRolesHandler);
router.post("/roles", validate({ body: createRoleSchema }), createRoleHandler);
router.patch("/roles/:id", validate({ body: updateRoleSchema }), updateRoleHandler);
router.delete("/roles/:id", deleteRoleHandler);

// User role assignment
router.patch("/users/:id/role", validate({ body: setUserCustomRoleSchema }), setUserCustomRoleHandler);

export { router as administrationRouter };
