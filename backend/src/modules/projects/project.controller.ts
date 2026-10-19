import type { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import {
  createProjectSchema,
  updateProjectSchema,
  projectSearchSchema,
  createProposalSchema,
  updateProposalSchema,
} from "./project.validation";
import * as projectService from "./project.service";

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

function requireUser(req: AuthenticatedRequest) {
  if (!req.user?.id) {
    throw new ApiError(401, "Authentication required");
  }

  return req.user;
}

export async function listProjects(req: Request, res: Response) {
  const query = projectSearchSchema.parse(req.query);
  const result = await projectService.listOpenProjects(query);

  return res.status(200).json({
    success: true,
    message: "Projects fetched successfully",
    data: result,
  });
}

export async function getProject(req: Request, res: Response) {
  const project = await projectService.getOpenProject(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Project fetched successfully",
    data: project,
  });
}

export async function createProject(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const input = createProjectSchema.parse(req.body);
  const project = await projectService.createProject(user.id, input);

  return res.status(201).json({
    success: true,
    message: "Project created as draft",
    data: project,
  });
}

export async function updateProject(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const input = updateProjectSchema.parse(req.body);
  const project = await projectService.updateProject(
    req.params.id,
    user.id,
    input,
  );

  return res.status(200).json({
    success: true,
    message: "Project updated successfully",
    data: project,
  });
}

export async function submitProject(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const project = await projectService.submitProject(req.params.id, user.id);

  return res.status(200).json({
    success: true,
    message: "Project submitted for admin review",
    data: project,
  });
}

export async function listMine(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const projects = await projectService.listMyProjects(user.id);

  return res.status(200).json({
    success: true,
    message: "Your projects fetched successfully",
    data: projects,
  });
}

export async function createProposal(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const input = createProposalSchema.parse(req.body);
  const proposal = await projectService.createProposal(
    user.id,
    req.params.id,
    input,
  );

  return res.status(201).json({
    success: true,
    message: "Proposal submitted successfully",
    data: proposal,
  });
}

export async function listProposals(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);

  if (user.role !== "EMPLOYER") {
    throw new ApiError(403, "Only project owners can view proposals");
  }

  const proposals = await projectService.listProjectProposals(
    user.id,
    req.params.id,
  );

  return res.status(200).json({
    success: true,
    message: "Proposals fetched successfully",
    data: proposals,
  });
}

export async function decideProposal(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);

  if (user.role !== "EMPLOYER") {
    throw new ApiError(403, "Only project owners can decide proposals");
  }

  const input = updateProposalSchema.parse(req.body);
  const proposal = await projectService.decideProposal(
    user.id,
    req.params.id,
    req.params.proposalId,
    input,
  );

  return res.status(200).json({
    success: true,
    message: `Proposal ${input.status.toLowerCase()} successfully`,
    data: proposal,
  });
}
