import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
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
router.put("/smtp", putSmtpHandler);
router.post("/smtp/test", testSmtpHandler);

// Custom Roles
router.get("/roles", getRolesHandler);
router.post("/roles", createRoleHandler);
router.patch("/roles/:id", updateRoleHandler);
router.delete("/roles/:id", deleteRoleHandler);

// User role assignment
router.patch("/users/:id/role", setUserCustomRoleHandler);

export { router as administrationRouter };
