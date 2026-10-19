import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from "./application.validation";

export async function createApplication(
  applicantId: string,
  input: CreateApplicationInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { id: true, role: true, status: true },
  });

  if (!user || user.role !== "JOB_SEEKER") {
    throw new ApiError(403, "Only job seekers can apply for jobs");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active");
  }

  const job = await prisma.job.findFirst({
    where: {
      id: input.jobId,
      status: "PUBLISHED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (!job) {
    throw new ApiError(404, "Published job not found or expired");
  }

  const existing = await prisma.jobApplication.findUnique({
    where: {
      jobId_applicantId: {
        jobId: input.jobId,
        applicantId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new ApiError(409, "You have already applied for this job");
  }

  const profile = await prisma.jobSeekerProfile.findUnique({
    where: { userId: applicantId },
    select: { resumeUrl: true },
  });

  try {
    return await prisma.jobApplication.create({
      data: {
        jobId: input.jobId,
        applicantId,
        coverLetter: input.coverLetter,
        resumeUrl: input.resumeUrl ?? profile?.resumeUrl ?? null,
        status: "PENDING",
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            company: { select: { name: true } },
          },
        },
      },
    });
  } catch (error) {
    // The unique database constraint also protects against concurrent requests.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "You have already applied for this job");
    }

    throw error;
  }
}

export async function listMyApplications(applicantId: string) {
  return prisma.jobApplication.findMany({
    where: { applicantId },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          slug: true,
          district: true,
          employmentType: true,
          status: true,
          company: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      },
    },
  });
}

export async function listApplicationsForEmployer(
  employerId: string,
  jobId: string,
) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, employerId },
    select: { id: true },
  });

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  return prisma.jobApplication.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          profile: {
            select: {
              headline: true,
              district: true,
              skills: true,
              resumeUrl: true,
            },
          },
        },
      },
    },
  });
}

export async function updateApplicationStatus(
  employerId: string,
  applicationId: string,
  input: UpdateApplicationStatusInput,
) {
  const application = await prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      job: { employerId },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  const terminalStatuses = ["HIRED", "REJECTED", "WITHDRAWN"];

  if (terminalStatuses.includes(application.status)) {
    throw new ApiError(
      400,
      "This application is already closed and cannot be updated",
    );
  }

  return prisma.jobApplication.update({
    where: { id: applicationId },
    data: { status: input.status },
    include: {
      job: { select: { id: true, title: true } },
      applicant: { select: { id: true, name: true } },
    },
  });
}

export async function withdrawApplication(
  applicantId: string,
  applicationId: string,
) {
  const application = await prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      applicantId,
    },
    select: { id: true, status: true },
  });

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  if (["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status)) {
    throw new ApiError(400, "This application cannot be withdrawn");
  }

  return prisma.jobApplication.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" },
  });
}
