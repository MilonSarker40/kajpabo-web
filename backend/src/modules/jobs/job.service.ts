import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type {
  CreateJobInput,
  UpdateJobInput,
  JobSearchInput,
} from "./job.validation";

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

  return `${base || "job"}-${randomUUID().slice(0, 8)}`;
}

function toJobData(data: CreateJobInput | UpdateJobInput) {
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && {
      description: data.description,
    }),
    ...(data.category !== undefined && { category: data.category }),
    ...(data.employmentType !== undefined && {
      employmentType: data.employmentType,
    }),
    ...(data.district !== undefined && { district: data.district }),
    ...(data.salaryMin !== undefined && {
      salaryMin:
        data.salaryMin === null ? null : new Prisma.Decimal(data.salaryMin),
    }),
    ...(data.salaryMax !== undefined && {
      salaryMax:
        data.salaryMax === null ? null : new Prisma.Decimal(data.salaryMax),
    }),
    ...(data.expiresAt !== undefined && {
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    }),
    ...(data.companyId !== undefined && { companyId: data.companyId }),
  };
}

export async function listPublishedJobs(query: JobSearchInput) {
  const { q, category, district, employmentType, page, limit } = query;

  const where: Prisma.JobWhereInput = {
    status: "PUBLISHED",
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(category && {
      category: { equals: category, mode: "insensitive" },
    }),
    ...(district && {
      district: { equals: district, mode: "insensitive" },
    }),
    ...(employmentType && { employmentType }),
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [jobs, total] = await prisma.$transaction([
    prisma.job.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: {
          select: { id: true, name: true, logoUrl: true, district: true },
        },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    items: jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPublishedJob(id: string) {
  const job = await prisma.job.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      status: "PUBLISHED",
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          district: true,
          website: true,
        },
      },
    },
  });

  if (!job) {
    throw new ApiError(404, "Published job not found");
  }

  return job;
}

export async function createJob(employerId: string, input: CreateJobInput) {
  const employer = await prisma.user.findUnique({
    where: { id: employerId },
    select: { id: true, role: true, status: true },
  });

  if (!employer || employer.role !== "EMPLOYER") {
    throw new ApiError(403, "Only employers can create jobs");
  }

  if (employer.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active");
  }

  if (input.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, ownerId: employerId },
      select: { id: true },
    });

    if (!company) {
      throw new ApiError(403, "You do not own this company");
    }
  }

  return prisma.job.create({
    data: {
      ...toJobData(input),
      title: input.title,
      slug: makeSlug(input.title),
      employerId,
      status: "DRAFT",
      currency: "BDT",
    },
  });
}

async function findOwnedJob(jobId: string, employerId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, employerId },
  });

  if (!job) {
    throw new ApiError(404, "Job not found");
  }

  return job;
}

export async function updateJob(
  jobId: string,
  employerId: string,
  input: UpdateJobInput,
) {
  const job = await findOwnedJob(jobId, employerId);

  if (job.status !== "DRAFT" && job.status !== "REJECTED") {
    throw new ApiError(
      400,
      "Only draft or rejected jobs can be edited. Close or contact admin for other statuses.",
    );
  }

  if (input.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, ownerId: employerId },
      select: { id: true },
    });

    if (!company) {
      throw new ApiError(403, "You do not own this company");
    }
  }

  return prisma.job.update({
    where: { id: jobId },
    data: {
      ...toJobData(input),
      ...(input.title !== undefined && {
        title: input.title,
        slug: makeSlug(input.title),
      }),
      status: job.status === "REJECTED" ? "DRAFT" : job.status,
    },
  });
}

export async function submitJob(jobId: string, employerId: string) {
  const job = await findOwnedJob(jobId, employerId);

  if (job.status !== "DRAFT" && job.status !== "REJECTED") {
    throw new ApiError(400, "Only draft or rejected jobs can be submitted");
  }

  if (
    !job.title.trim() ||
    job.description.trim().length < 30 ||
    !job.category.trim() ||
    !job.employmentType.trim()
  ) {
    throw new ApiError(400, "Complete all required job fields first");
  }

  return prisma.job.update({
    where: { id: jobId },
    data: { status: "PENDING" },
  });
}

export async function closeJob(jobId: string, employerId: string) {
  const job = await findOwnedJob(jobId, employerId);

  if (job.status !== "PUBLISHED" && job.status !== "PENDING") {
    throw new ApiError(400, "This job cannot be closed in its current status");
  }

  return prisma.job.update({
    where: { id: jobId },
    data: { status: "CLOSED" },
  });
}

export async function listMyJobs(employerId: string) {
  return prisma.job.findMany({
    where: { employerId },
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
  });
}
