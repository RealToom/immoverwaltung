import { z } from "zod";

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(300).optional(),
  address: z.string().max(500).optional(),
  taxNumber: z.string().max(50).optional(),
  website: z.string().max(500).optional(),
  currency: z.enum(["EUR", "CHF", "USD"]).optional(),
  language: z.enum(["de", "en"]).optional(),
  dateFormat: z.string().max(20).optional(),
  itemsPerPage: z.number().int().min(10).max(100).optional(),
});

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
