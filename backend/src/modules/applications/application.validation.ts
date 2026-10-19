import { z } from "zod";

export const createApplicationSchema = z
  .object({
    jobId: z.string().uuid(),
    coverLetter: z.string().trim().min(20).max(5000),
    resumeUrl: z.string().url().max(2048).optional(),
  })
  .strict();

export const updateApplicationStatusSchema = z
  .object({
    status: z.enum([
      "REVIEWING",
      "SHORTLISTED",
      "INTERVIEW",
      "HIRED",
      "REJECTED",
    ]),
  })
  .strict();

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;
