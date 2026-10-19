import { Router } from "express";
import * as adminController from "./admin.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/dashboard", asyncHandler(adminController.dashboard));

router.get("/jobs/pending", asyncHandler(adminController.pendingJobs));

router.patch("/jobs/:id/review", asyncHandler(adminController.reviewJob));

router.get("/projects/pending", asyncHandler(adminController.pendingProjects));

router.patch(
  "/projects/:id/review",
  asyncHandler(adminController.reviewProject),
);

router.get("/users", asyncHandler(adminController.users));

router.patch(
  "/users/:id/status",
  asyncHandler(adminController.updateUserStatus),
);

router.get("/reports", asyncHandler(adminController.reports));

router.patch("/reports/:id/review", asyncHandler(adminController.reviewReport));

router.get("/audit-logs", asyncHandler(adminController.auditLogs));

export default router;
