import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import {
  registerSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
} from "./auth.validation";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function requestOtp(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = requestOtpSchema.parse(req.body);
    const result = await authService.requestOtp(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtp(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = verifyOtpSchema.parse(req.body);
    const result = await authService.verifyOtp(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshSession(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = logoutSchema.parse(req.body);
    const result = await authService.logoutSession(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
