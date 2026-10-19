import { Router } from "express";
import * as profileController from "./profile.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

// Public profile — must be declared before "/me" only if route patterns overlap.
// These patterns do not overlap, but keeping "/me" first improves readability.
router.get("/me", authenticate, asyncHandler(profileController.getMe));

router.patch("/me", authenticate, asyncHandler(profileController.updateMe));

router.patch(
  "/me/progress",
  authenticate,
  asyncHandler(profileController.updateProgress),
);

router.get("/:userId", asyncHandler(profileController.getPublic));

export default router;
