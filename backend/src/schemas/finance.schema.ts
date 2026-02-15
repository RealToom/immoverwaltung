import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const financeQuerySchema = paginationSchema.extend({
  type: z.enum(["EINNAHME", "AUSGABE"]).optional(),
});

export const monthlyQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(24).default(12),
});

export const createTransactionSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1).max(500),
  type: z.enum(["EINNAHME", "AUSGABE"]),
  amount: z.number().positive(),
  category: z.string().max(200).optional(),
  propertyId: z.number().int().positive().nullable().optional(),
});

export const rentCollectionQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(8),
});
