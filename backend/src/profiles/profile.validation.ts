import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const jsonArraySchema = z.array(z.record(z.string(), z.unknown())).max(100);

export const updateProfileSchema = z
  .object({
    headline: optionalText(150),
    summary: optionalText(5000),
    dateOfBirth: z.string().datetime({ offset: true }).optional().nullable(),
    district: optionalText(100),
    address: optionalText(300),
    skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    education: jsonArraySchema.optional(),
    experience: jsonArraySchema.optional(),
    resumeUrl: z.string().url().max(2048).optional().nullable(),
    completedSteps: z.number().int().min(0).max(20).optional(),
    profileCompleted: z.boolean().optional(),
  })
  .strict();

export const profileProgressSchema = z
  .object({
    completedSteps: z.number().int().min(0).max(20),
    profileCompleted: z.boolean().optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProfileProgressInput = z.infer<typeof profileProgressSchema>;
