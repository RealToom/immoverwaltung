import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as ctrl from "../controllers/energy.controller.js";

const router = Router();

router.get("/consumption", ctrl.getConsumptionHandler);
router.get("/passport/:propertyId", ctrl.getPassportHandler);
router.put(
  "/passport/:propertyId",
  requireRole("ADMIN", "VERWALTER"),
  ctrl.upsertPassportHandler,
);

export { router as energyRouter };
