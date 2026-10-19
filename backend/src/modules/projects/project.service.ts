import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectSearchInput,
  CreateProposalInput,
  UpdateProposalInput,
} from "./project.validation";

function makeSlug(title: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

  return `${base || "project"}-${randomUUID().slice(0, 8)}`;
}

function projectData(data: CreateProjectInput | UpdateProjectInput) {
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.budgetMin !== undefined && {
      budgetMin:
        data.budgetMin === null ? null : new Prisma.Decimal(data.budgetMin),
    }),
    ...(data.budgetMax !== undefined && {
      budgetMax:
        data.budgetMax === null ? null : new Prisma.Decimal(data.budgetMax),
    }),
    ...(data.deadline !== undefined && {
      deadline: data.deadline ? new Date(data.deadline) : null,
    }),
    ...(data.companyId !== undefined && { companyId: data.companyId }),
  };
}

export async function listOpenProjects(query: ProjectSearchInput) {
  const { q, page, limit } = query;

  const where: Prisma.ProjectWhereInput = {
    status: "OPEN",
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
      },
    }),
    prisma.project.count({ where }),
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

export async function getOpenProject(idOrSlug: string) {
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { title: { equals: idOrSlug, mode: "insensitive" } },
      ],
      status: "OPEN",
    },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
    },
  });

  if (!project) {
    throw new ApiError(404, "Open project not found");
  }

  return project;
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true, status: true },
  });

  if (!owner || owner.role !== "EMPLOYER") {
    throw new ApiError(403, "Only employers can post projects");
  }

  if (owner.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active");
  }

  if (input.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, ownerId },
      select: { id: true },
    });

    if (!company) {
      throw new ApiError(403, "You do not own this company");
    }
  }

  return prisma.project.create({
    data: {
      ...projectData(input),
      title: input.title,
      description: input.description,
      ownerId,
      status: "DRAFT",
      currency: "BDT",
    },
  });
}

async function findOwnedProject(projectId: string, ownerId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  return project;
}

export async function updateProject(
  projectId: string,
  ownerId: string,
  input: UpdateProjectInput,
) {
  const project = await findOwnedProject(projectId, ownerId);

  if (project.status !== "DRAFT") {
    throw new ApiError(400, "Only draft projects can be edited");
  }

  if (input.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: input.companyId, ownerId },
      select: { id: true },
    });

    if (!company) {
      throw new ApiError(403, "You do not own this company");
    }
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...projectData(input),
      ...(input.title !== undefined && { title: input.title }),
    },
  });
}

export async function submitProject(projectId: string, ownerId: string) {
  const project = await findOwnedProject(projectId, ownerId);

  if (project.status !== "DRAFT") {
    throw new ApiError(400, "Only draft projects can be submitted");
  }

  return prisma.project.update({
    where: { id: projectId },
    data: { status: "PENDING" },
  });
}

export async function listMyProjects(ownerId: string) {
  return prisma.project.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      _count: { select: { proposals: true } },
    },
  });
}

export async function createProposal(
  freelancerId: string,
  projectId: string,
  input: CreateProposalInput,
) {
  const freelancer = await prisma.user.findUnique({
    where: { id: freelancerId },
    select: { id: true, role: true, status: true },
  });

  if (!freelancer || freelancer.role !== "JOB_SEEKER") {
    throw new ApiError(403, "Only job seekers can submit proposals");
  }

  if (freelancer.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: "OPEN" },
    select: { id: true, ownerId: true, budgetMin: true, budgetMax: true },
  });

  if (!project) {
    throw new ApiError(404, "Open project not found");
  }

  if (project.ownerId === freelancerId) {
    throw new ApiError(400, "You cannot submit a proposal to your own project");
  }

  if (
    project.budgetMin !== null &&
    input.bidAmount < Number(project.budgetMin)
  ) {
    throw new ApiError(400, "Your bid is below the project's minimum budget");
  }

  if (
    project.budgetMax !== null &&
    input.bidAmount > Number(project.budgetMax)
  ) {
    throw new ApiError(400, "Your bid exceeds the project's maximum budget");
  }

  try {
    return await prisma.proposal.create({
      data: {
        projectId,
        freelancerId,
        coverLetter: input.coverLetter,
        bidAmount: new Prisma.Decimal(input.bidAmount),
        currency: "BDT",
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "You have already submitted a proposal");
    }

    throw error;
  }
}

export async function listProjectProposals(ownerId: string, projectId: string) {
  const project = await findOwnedProject(projectId, ownerId);

  return prisma.proposal.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      freelancer: {
        select: {
          id: true,
          name: true,
          profile: {
            select: {
              headline: true,
              district: true,
              skills: true,
            },
          },
        },
      },
    },
  });
}

export async function decideProposal(
  ownerId: string,
  projectId: string,
  proposalId: string,
  input: UpdateProposalInput,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, ownerId },
    });

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    if (project.status !== "OPEN") {
      throw new ApiError(400, "Project is not open for proposal decisions");
    }

    const proposal = await tx.proposal.findFirst({
      where: { id: proposalId, projectId },
    });

    if (!proposal) {
      throw new ApiError(404, "Proposal not found");
    }

    if (proposal.status !== "PENDING") {
      throw new ApiError(400, "Only pending proposals can be decided");
    }

    if (input.status === "REJECTED") {
      return tx.proposal.update({
        where: { id: proposalId },
        data: { status: "REJECTED" },
      });
    }

    // Accepting one proposal starts the project and rejects competing pending bids.
    const accepted = await tx.proposal.updateMany({
      where: {
        id: proposalId,
        projectId,
        status: "PENDING",
      },
      data: { status: "ACCEPTED" },
    });

    if (accepted.count !== 1) {
      throw new ApiError(409, "Proposal has already been processed");
    }

    const projectUpdate = await tx.project.updateMany({
      where: { id: projectId, ownerId, status: "OPEN" },
      data: { status: "IN_PROGRESS" },
    });

    if (projectUpdate.count !== 1) {
      throw new ApiError(409, "Project status changed; please retry");
    }

    await tx.proposal.updateMany({
      where: {
        projectId,
        id: { not: proposalId },
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });

    return tx.proposal.findUniqueOrThrow({
      where: { id: proposalId },
    });
  });
}
