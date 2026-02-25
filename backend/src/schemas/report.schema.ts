import { z } from "zod";

export const reportExportQuerySchema = z.object({
  format: z.enum(["csv", "pdf"]).default("csv"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
