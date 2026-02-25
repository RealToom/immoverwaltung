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
