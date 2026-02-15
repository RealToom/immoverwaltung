import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().max(200).optional().default(""),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const propertyIdParamSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
});

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
