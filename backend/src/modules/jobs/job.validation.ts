import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const salarySchema = z.number().finite().min(0).max(1_000_000_000);

export const createJobSchema = z
  .object({
    title: z.string().trim().min(5).max(180),
    description: z.string().trim().min(30).max(20000),
    category: z.string().trim().min(2).max(100),
    employmentType: z.string().trim().min(2).max(50),
    district: optionalText(100),
    salaryMin: salarySchema.optional().nullable(),
    salaryMax: salarySchema.optional().nullable(),
    expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
    companyId: z.string().uuid().optional().nullable(),
  })
  .strict()
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMin <= data.salaryMax,
    {
      message: "Minimum salary cannot exceed maximum salary",
      path: ["salaryMax"],
    },
  );

export const updateJobSchema = createJobSchema.partial().strict();

export const jobSearchSchema = z.object({
  q: z.string().trim().max(150).optional(),
  category: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  employmentType: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type JobSearchInput = z.infer<typeof jobSearchSchema>;
