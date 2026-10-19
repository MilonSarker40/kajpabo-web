import { Router } from "express";
import * as projectController from "./project.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/async-handler";

const router = Router();

// Public project discovery
router.get("/", asyncHandler(projectController.listProjects));
router.get("/:id", asyncHandler(projectController.getProject));

// Project owner routes
router.get(
  "/mine/list",
  authenticate,
  asyncHandler(projectController.listMine),
);

router.post("/", authenticate, asyncHandler(projectController.createProject));

router.patch(
  "/:id",
  authenticate,
  asyncHandler(projectController.updateProject),
);

router.post(
  "/:id/submit",
  authenticate,
  asyncHandler(projectController.submitProject),
);

// Freelancer proposal routes
router.post(
  "/:id/proposals",
  authenticate,
  asyncHandler(projectController.createProposal),
);

// Owner-only proposal management
router.get(
  "/:id/proposals",
  authenticate,
  asyncHandler(projectController.listProposals),
);

router.patch(
  "/:id/proposals/:proposalId",
  authenticate,
  asyncHandler(projectController.decideProposal),
);

export default router;
