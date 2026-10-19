import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type {
  ReviewInput,
  UserListInput,
  UpdateUserStatusInput,
  ReportListInput,
  ReviewReportInput,
  AuditLogInput,
} from "./admin.validation";

async function writeAudit(
  tx: Prisma.TransactionClient,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue,
  ipAddress?: string,
) {
  await tx.adminAuditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress,
    },
  });
}

export async function getDashboardStats() {
  const [
    totalUsers,
    activeUsers,
    totalJobs,
    pendingJobs,
    publishedJobs,
    totalProjects,
    pendingProjects,
    openProjects,
    pendingReports,
    totalApplications,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.job.count(),
    prisma.job.count({ where: { status: "PENDING" } }),
    prisma.job.count({ where: { status: "PUBLISHED" } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: "PENDING" } }),
    prisma.project.count({ where: { status: "OPEN" } }),
    prisma.contentReport.count({
      where: { status: { in: ["PENDING", "REVIEWING"] } },
    }),
    prisma.jobApplication.count(),
  ]);

  return {
    users: { total: totalUsers, active: activeUsers },
    jobs: {
      total: totalJobs,
      pending: pendingJobs,
      published: publishedJobs,
    },
    projects: {
      total: totalProjects,
      pending: pendingProjects,
      open: openProjects,
    },
    pendingReports,
    totalApplications,
  };
}

export async function listPendingJobs() {
  return prisma.job.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      employer: { select: { id: true, name: true, phone: true } },
      company: { select: { id: true, name: true } },
    },
  });
}

export async function reviewJob(
  adminId: string,
  jobId: string,
  input: ReviewInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });

    if (!job || job.status !== "PENDING") {
      throw new ApiError(404, "Pending job not found");
    }

    const updated = await tx.job.update({
      where: { id: jobId },
      data:
        input.decision === "APPROVE"
          ? { status: "PUBLISHED", publishedAt: new Date() }
          : { status: "REJECTED", publishedAt: null },
    });

    await writeAudit(
      tx,
      adminId,
      `JOB_${input.decision}`,
      "JOB",
      jobId,
      {
        reason: input.reason ?? "",
        previousStatus: job.status,
        newStatus: updated.status,
      },
      ipAddress,
    );

    return updated;
  });
}

export async function listPendingProjects() {
  return prisma.project.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      owner: { select: { id: true, name: true, phone: true } },
      company: { select: { id: true, name: true } },
    },
  });
}

export async function reviewProject(
  adminId: string,
  projectId: string,
  input: ReviewInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.status !== "PENDING") {
      throw new ApiError(404, "Pending project not found");
    }

    // Current ProjectStatus enum has no REJECTED value.
    const newStatus = input.decision === "APPROVE" ? "OPEN" : "DRAFT";

    const updated = await tx.project.update({
      where: { id: projectId },
      data: { status: newStatus },
    });

    await writeAudit(
      tx,
      adminId,
      `PROJECT_${input.decision}`,
      "PROJECT",
      projectId,
      {
        reason: input.reason ?? "",
        previousStatus: project.status,
        newStatus,
      },
      ipAddress,
    );

    return updated;
  });
}

export async function listUsers(query: UserListInput) {
  const { q, role, status, page, limit } = query;

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        status: true,
        phoneVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateUserStatus(
  adminId: string,
  userId: string,
  input: UpdateUserStatusInput,
  ipAddress?: string,
) {
  if (adminId === userId) {
    throw new ApiError(400, "You cannot change your own account status");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.role === "ADMIN") {
      throw new ApiError(403, "Admin accounts cannot be moderated here");
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { status: input.status },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (input.status === "SUSPENDED") {
      // Revoke existing sessions when an account is suspended.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await writeAudit(
      tx,
      adminId,
      `USER_${input.status}`,
      "USER",
      userId,
      {
        reason: input.reason,
        previousStatus: user.status,
        newStatus: updated.status,
      },
      ipAddress,
    );

    return updated;
  });
}

export async function listReports(query: ReportListInput) {
  const { status, page, limit } = query;
  const where: Prisma.ContentReportWhereInput = {
    ...(status && { status }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.contentReport.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: {
          select: { id: true, name: true },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.contentReport.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function reviewReport(
  adminId: string,
  reportId: string,
  input: ReviewReportInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.contentReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new ApiError(404, "Report not found");
    }

    if (report.status === "RESOLVED" || report.status === "DISMISSED") {
      throw new ApiError(400, "Report has already been closed");
    }

    const updated = await tx.contentReport.update({
      where: { id: reportId },
      data: {
        status: input.status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    await writeAudit(
      tx,
      adminId,
      `REPORT_${input.status}`,
      "REPORT",
      reportId,
      {
        reason: input.reason,
        previousStatus: report.status,
        newStatus: updated.status,
        targetType: report.targetType,
        targetId: report.targetId,
      },
      ipAddress,
    );

    return updated;
  });
}

export async function listAuditLogs(query: AuditLogInput) {
  const { page, limit } = query;

  const [items, total] = await prisma.$transaction([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        admin: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.adminAuditLog.count(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
