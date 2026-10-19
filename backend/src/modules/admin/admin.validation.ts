import { z } from "zod";

export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const userListSchema = z.object({
  q: z.string().trim().max(150).optional(),
  role: z.enum(["JOB_SEEKER", "EMPLOYER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const reportListSchema = z.object({
  status: z.enum(["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewReportSchema = z
  .object({
    status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const auditLogSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
export type UserListInput = z.infer<typeof userListSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ReportListInput = z.infer<typeof reportListSchema>;
export type ReviewReportInput = z.infer<typeof reviewReportSchema>;
export type AuditLogInput = z.infer<typeof auditLogSchema>;
