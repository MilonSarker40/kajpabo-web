import type { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import {
  createApplicationSchema,
  updateApplicationStatusSchema,
} from "./application.validation";
import * as applicationService from "./application.service";

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

export async function apply(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const input = createApplicationSchema.parse(req.body);

  const application = await applicationService.createApplication(
    user.id,
    input,
  );

  return res.status(201).json({
    success: true,
    message: "Application submitted successfully",
    data: application,
  });
}

export async function listMine(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const applications = await applicationService.listMyApplications(user.id);

  return res.status(200).json({
    success: true,
    message: "Your applications fetched successfully",
    data: applications,
  });
}

export async function listForJob(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);

  if (user.role !== "EMPLOYER" && user.role !== "ADMIN") {
    throw new ApiError(403, "Only employers can view job applications");
  }

  const applications = await applicationService.listApplicationsForEmployer(
    user.id,
    req.params.jobId,
  );

  return res.status(200).json({
    success: true,
    message: "Job applications fetched successfully",
    data: applications,
  });
}

export async function updateStatus(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);

  if (user.role !== "EMPLOYER" && user.role !== "ADMIN") {
    throw new ApiError(403, "Only employers can update application status");
  }

  const input = updateApplicationStatusSchema.parse(req.body);

  const application = await applicationService.updateApplicationStatus(
    user.id,
    req.params.id,
    input,
  );

  return res.status(200).json({
    success: true,
    message: "Application status updated successfully",
    data: application,
  });
}

export async function withdraw(req: Request, res: Response) {
  const user = requireUser(req as AuthenticatedRequest);
  const application = await applicationService.withdrawApplication(
    user.id,
    req.params.id,
  );

  return res.status(200).json({
    success: true,
    message: "Application withdrawn successfully",
    data: application,
  });
}
