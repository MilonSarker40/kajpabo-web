import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .transform((value) =>
    value.startsWith("+8801")
      ? value
      : value.startsWith("01")
        ? `+88${value}`
        : value,
  )
  .pipe(
    z.string().regex(/^\+8801[3-9]\d{8}$/, "Invalid Bangladesh phone number"),
  );

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  role: z.enum(["JOB_SEEKER", "EMPLOYER"]),
});

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(["REGISTER", "LOGIN"]),
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["JOB_SEEKER", "EMPLOYER"]).optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "OTP must contain 6 digits"),
  purpose: z.enum(["REGISTER", "LOGIN"]),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32),
});

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
