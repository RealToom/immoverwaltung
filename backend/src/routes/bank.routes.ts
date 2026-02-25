import { Router } from "express";
import { requireRole } from "../middleware/requireRole.js";
import * as bankController from "../controllers/bank.controller.js";

const router = Router({ mergeParams: true });

router.get("/", bankController.list);
router.post("/", requireRole("ADMIN", "VERWALTER"), bankController.create);
router.post("/import", requireRole("ADMIN", "VERWALTER", "BUCHHALTER"), bankController.importCsv);
router.delete("/:id", requireRole("ADMIN", "VERWALTER"), bankController.remove);
router.post("/:id/sync", requireRole("ADMIN", "VERWALTER"), bankController.sync);

export { router as bankRouter };
