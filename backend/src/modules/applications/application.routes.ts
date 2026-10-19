import { Router } from "express";
import * as applicationController from "./application.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

router.post("/", authenticate, asyncHandler(applicationController.apply));

router.get(
  "/mine/list",
  authenticate,
  asyncHandler(applicationController.listMine),
);

router.get(
  "/job/:jobId",
  authenticate,
  asyncHandler(applicationController.listForJob),
);

router.patch(
  "/:id/status",
  authenticate,
  asyncHandler(applicationController.updateStatus),
);

router.post(
  "/:id/withdraw",
  authenticate,
  asyncHandler(applicationController.withdraw),
);

export default router;
