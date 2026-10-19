import type { Request, Response } from "express";
import { ApiError } from "../../utils/api-error";
import * as adminService from "./admin.service";
import {
  reviewSchema,
  userListSchema,
  updateUserStatusSchema,
  reportListSchema,
  reviewReportSchema,
  auditLogSchema,
} from "./admin.validation";

type AdminRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

function getAdminId(req: AdminRequest) {
  if (!req.user?.id || req.user.role !== "ADMIN") {
    throw new ApiError(403, "Admin access required");
  }

  return req.user.id;
}

function getIp(req: Request) {
  // Do not trust forwarded IP headers unless Express proxy trust is configured.
  return req.ip;
}

export async function dashboard(_req: Request, res: Response) {
  const data = await adminService.getDashboardStats();

  return res.status(200).json({
    success: true,
    message: "Admin dashboard statistics fetched",
    data,
  });
}

export async function pendingJobs(_req: Request, res: Response) {
  const data = await adminService.listPendingJobs();

  return res.status(200).json({
    success: true,
    message: "Pending jobs fetched",
    data,
  });
}

export async function reviewJob(req: Request, res: Response) {
  const adminId = getAdminId(req as AdminRequest);
  const input = reviewSchema.parse(req.body);

  const data = await adminService.reviewJob(
    adminId,
    req.params.id,
    input,
    getIp(req),
  );

  return res.status(200).json({
    success: true,
    message: `Job ${input.decision.toLowerCase()}d successfully`,
    data,
  });
}

export async function pendingProjects(_req: Request, res: Response) {
  const data = await adminService.listPendingProjects();

  return res.status(200).json({
    success: true,
    message: "Pending projects fetched",
    data,
  });
}

export async function reviewProject(req: Request, res: Response) {
  const adminId = getAdminId(req as AdminRequest);
  const input = reviewSchema.parse(req.body);

  const data = await adminService.reviewProject(
    adminId,
    req.params.id,
    input,
    getIp(req),
  );

  return res.status(200).json({
    success: true,
    message: `Project review completed: ${input.decision}`,
    data,
  });
}

export async function users(req: Request, res: Response) {
  const query = userListSchema.parse(req.query);
  const data = await adminService.listUsers(query);

  return res.status(200).json({
    success: true,
    message: "Users fetched",
    data,
  });
}

export async function updateUserStatus(req: Request, res: Response) {
  const adminId = getAdminId(req as AdminRequest);
  const input = updateUserStatusSchema.parse(req.body);

  const data = await adminService.updateUserStatus(
    adminId,
    req.params.id,
    input,
    getIp(req),
  );

  return res.status(200).json({
    success: true,
    message: "User status updated",
    data,
  });
}

export async function reports(req: Request, res: Response) {
  const query = reportListSchema.parse(req.query);
  const data = await adminService.listReports(query);

  return res.status(200).json({
    success: true,
    message: "Reports fetched",
    data,
  });
}

export async function reviewReport(req: Request, res: Response) {
  const adminId = getAdminId(req as AdminRequest);
  const input = reviewReportSchema.parse(req.body);

  const data = await adminService.reviewReport(
    adminId,
    req.params.id,
    input,
    getIp(req),
  );

  return res.status(200).json({
    success: true,
    message: "Report reviewed successfully",
    data,
  });
}

export async function auditLogs(req: Request, res: Response) {
  const query = auditLogSchema.parse(req.query);
  const data = await adminService.listAuditLogs(query);

  return res.status(200).json({
    success: true,
    message: "Audit logs fetched",
    data,
  });
}
