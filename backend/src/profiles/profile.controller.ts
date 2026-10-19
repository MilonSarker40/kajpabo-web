import type { Request, Response } from "express";
import {
  updateProfileSchema,
  profileProgressSchema,
} from "./profile.validation";
import * as profileService from "./profile.service";

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

function getUserId(req: AuthenticatedRequest): string {
  if (!req.user?.id) {
    throw new Error("Authenticated user ID is missing");
  }

  return req.user.id;
}

export async function getMe(req: Request, res: Response) {
  const userId = getUserId(req as AuthenticatedRequest);
  const profile = await profileService.getMyProfile(userId);

  return res.status(200).json({
    success: true,
    message: "Profile fetched successfully",
    data: profile,
  });
}

export async function updateMe(req: Request, res: Response) {
  const userId = getUserId(req as AuthenticatedRequest);
  const input = updateProfileSchema.parse(req.body);
  const profile = await profileService.updateMyProfile(userId, input);

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: profile,
  });
}

export async function updateProgress(req: Request, res: Response) {
  const userId = getUserId(req as AuthenticatedRequest);
  const input = profileProgressSchema.parse(req.body);
  const profile = await profileService.updateProfileProgress(userId, input);

  return res.status(200).json({
    success: true,
    message: "Profile progress saved successfully",
    data: profile,
  });
}

export async function getPublic(req: Request, res: Response) {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  const profile = await profileService.getPublicProfile(userId);

  return res.status(200).json({
    success: true,
    message: "Public profile fetched successfully",
    data: profile,
  });
}
