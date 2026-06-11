import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const initiateRequisitionSchema = z.object({
  bankAccountId: z.number().int().positive(),
  institutionId: z.string().min(1).max(200),
});

export const bankTransactionQuerySchema = paginationSchema.extend({
  status: z.enum(["UNMATCHED", "MATCHED", "IGNORED"]).optional(),
});

export const listInstitutionsSchema = z.object({
  country: z.string().length(2).toUpperCase().default("DE"),
});

export const importTransactionsSchema = z.object({
  transactions: z
    .array(
      z.object({
        date: z.string().refine((s) => !isNaN(Date.parse(s)), "Ungültiges Datum"),
        description: z.string().min(1).max(500),
        amount: z.number().finite(),
        iban: z.string().max(42).optional().default(""),
      })
    )
    .min(1)
    .max(1000),
});
