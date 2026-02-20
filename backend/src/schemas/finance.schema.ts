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
  amount: z.number().positive().multipleOf(0.01, { message: "Betrag maximal 2 Dezimalstellen (Cent-genau)" }),
  category: z.string().max(200).optional(),
  propertyId: z.number().int().positive().nullable().optional(),
});

export const rentCollectionQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(8),
});

export const updateTransactionSchema = z.object({
  allocatable: z.boolean().optional(),
  category: z.string().max(200).optional(),
});

export const utilityStatementQuerySchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});

export const roiQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
});
