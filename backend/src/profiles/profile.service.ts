import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import type {
  UpdateProfileInput,
  ProfileProgressInput,
} from "./profile.validation";

export async function getMyProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      phoneVerifiedAt: true,
      createdAt: true,
      profile: true,
      company: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

export async function updateMyProfile(
  userId: string,
  data: UpdateProfileInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role !== "JOB_SEEKER") {
    throw new ApiError(403, "Only job seekers can update this profile");
  }

  const {
    headline,
    summary,
    dateOfBirth,
    district,
    address,
    skills,
    education,
    experience,
    resumeUrl,
    completedSteps,
    profileCompleted,
  } = data;

  const profileData = {
    ...(headline !== undefined && { headline }),
    ...(summary !== undefined && { summary }),
    ...(dateOfBirth !== undefined && {
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    }),
    ...(district !== undefined && { district }),
    ...(address !== undefined && { address }),
    ...(skills !== undefined && { skills }),
    ...(education !== undefined && { education }),
    ...(experience !== undefined && { experience }),
    ...(resumeUrl !== undefined && { resumeUrl }),
    ...(completedSteps !== undefined && { completedSteps }),
    ...(profileCompleted !== undefined && { profileCompleted }),
  };

  return prisma.jobSeekerProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...profileData,
    },
    update: profileData,
  });
}

export async function updateProfileProgress(
  userId: string,
  data: ProfileProgressInput,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role !== "JOB_SEEKER") {
    throw new ApiError(403, "Only job seekers can update profile progress");
  }

  return prisma.jobSeekerProfile.upsert({
    where: { userId },
    create: {
      userId,
      completedSteps: data.completedSteps,
      ...(data.profileCompleted !== undefined && {
        profileCompleted: data.profileCompleted,
      }),
    },
    update: {
      completedSteps: data.completedSteps,
      ...(data.profileCompleted !== undefined && {
        profileCompleted: data.profileCompleted,
      }),
    },
  });
}

export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      role: "JOB_SEEKER",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      profile: {
        select: {
          headline: true,
          summary: true,
          district: true,
          skills: true,
          education: true,
          experience: true,
          resumeUrl: true,
          profileCompleted: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "Public profile not found");
  }

  return user;
}
