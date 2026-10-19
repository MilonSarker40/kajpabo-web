import { Router } from "express";
import * as jobController from "./job.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

// Keep static paths before "/:id".
router.get("/", asyncHandler(jobController.listJobs));

router.get("/mine/list", authenticate, asyncHandler(jobController.listMine));

router.post("/", authenticate, asyncHandler(jobController.createJob));

router.get("/:id", asyncHandler(jobController.getJob));

router.patch("/:id", authenticate, asyncHandler(jobController.updateJob));

router.post("/:id/submit", authenticate, asyncHandler(jobController.submitJob));

router.post("/:id/close", authenticate, asyncHandler(jobController.closeJob));

export default router;
