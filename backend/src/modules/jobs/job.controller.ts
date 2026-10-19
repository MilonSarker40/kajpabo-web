import type { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import {
  createJobSchema,
  updateJobSchema,
  jobSearchSchema,
} from "./job.validation";
import * as jobService from "./job.service";

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

function getUser(req: AuthenticatedRequest) {
  if (!req.user?.id) {
    throw new ApiError(401, "Authentication required");
  }

  return req.user;
}

export async function listJobs(req: Request, res: Response) {
  const query = jobSearchSchema.parse(req.query);
  const result = await jobService.listPublishedJobs(query);

  return res.status(200).json({
    success: true,
    message: "Jobs fetched successfully",
    data: result,
  });
}

export async function getJob(req: Request, res: Response) {
  const job = await jobService.getPublishedJob(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Job fetched successfully",
    data: job,
  });
}

export async function createJob(req: Request, res: Response) {
  const user = getUser(req as AuthenticatedRequest);
  const input = createJobSchema.parse(req.body);
  const job = await jobService.createJob(user.id, input);

  return res.status(201).json({
    success: true,
    message: "Job created as draft",
    data: job,
  });
}

export async function updateJob(req: Request, res: Response) {
  const user = getUser(req as AuthenticatedRequest);
  const input = updateJobSchema.parse(req.body);
  const job = await jobService.updateJob(req.params.id, user.id, input);

  return res.status(200).json({
    success: true,
    message: "Job updated successfully",
    data: job,
  });
}

export async function submitJob(req: Request, res: Response) {
  const user = getUser(req as AuthenticatedRequest);
  const job = await jobService.submitJob(req.params.id, user.id);

  return res.status(200).json({
    success: true,
    message: "Job submitted for admin review",
    data: job,
  });
}

export async function closeJob(req: Request, res: Response) {
  const user = getUser(req as AuthenticatedRequest);
  const job = await jobService.closeJob(req.params.id, user.id);

  return res.status(200).json({
    success: true,
    message: "Job closed successfully",
    data: job,
  });
}

export async function listMine(req: Request, res: Response) {
  const user = getUser(req as AuthenticatedRequest);
  const jobs = await jobService.listMyJobs(user.id);

  return res.status(200).json({
    success: true,
    message: "Your jobs fetched successfully",
    data: jobs,
  });
}
