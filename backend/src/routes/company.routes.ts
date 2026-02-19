import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { requireRole } from "../middleware/requireRole.js";
import { updateCompanySchema } from "../schemas/company.schema.js";
import { getCompanyHandler, updateCompanyHandler } from "../controllers/company.controller.js";

const router = Router();

router.get("/", getCompanyHandler);
router.patch(
  "/",
  requireRole("ADMIN", "VERWALTER"),
  validate({ body: updateCompanySchema }),
  updateCompanyHandler
);

export { router as companyRouter };
