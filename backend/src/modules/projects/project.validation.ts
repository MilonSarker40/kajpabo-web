import { z } from "zod";

const budgetSchema = z.number().finite().min(0).max(1_000_000_000);

const projectFields = {
  title: z.string().trim().min(5).max(180),
  description: z.string().trim().min(30).max(20000),
  budgetMin: budgetSchema.optional().nullable(),
  budgetMax: budgetSchema.optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
};

const budgetRangeIsValid = (data: {
  budgetMin?: number | null;
  budgetMax?: number | null;
}) =>
  data.budgetMin == null ||
  data.budgetMax == null ||
  data.budgetMin <= data.budgetMax;

export const createProjectSchema = z
  .object(projectFields)
  .strict()
  .refine(budgetRangeIsValid, {
    message: "Minimum budget cannot exceed maximum budget",
    path: ["budgetMax"],
  });

export const updateProjectSchema = z
  .object(projectFields)
  .partial()
  .strict()
  .refine(budgetRangeIsValid, {
    message: "Minimum budget cannot exceed maximum budget",
    path: ["budgetMax"],
  });

export const projectSearchSchema = z.object({
  q: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const createProposalSchema = z
  .object({
    coverLetter: z.string().trim().min(20).max(5000),
    bidAmount: budgetSchema,
  })
  .strict();

export const updateProposalSchema = z
  .object({
    status: z.enum(["ACCEPTED", "REJECTED"]),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectSearchInput = z.infer<typeof projectSearchSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
