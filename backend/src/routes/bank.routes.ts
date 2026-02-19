import { Router } from "express";
import * as bankController from "../controllers/bank.controller.js";

const router = Router({ mergeParams: true });

router.get("/", bankController.list);
router.post("/", bankController.create);
router.post("/import", bankController.importCsv);
router.delete("/:id", bankController.remove);
router.post("/:id/sync", bankController.sync);

export { router as bankRouter };
