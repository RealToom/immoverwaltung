import { z } from "zod";

export const datevSettingsSchema = z.object({
  beraternummer: z.number().int().min(1001).max(9999999).nullable().optional(),
  mandantennummer: z.number().int().min(1).max(99999).nullable().optional(),
  kontenrahmen: z.enum(["SKR03", "SKR04"]).optional(),
  defaultBankAccount: z.string().length(4).optional(),
  defaultIncomeAccount: z.string().length(4).optional(),
  defaultExpenseAccount: z.string().length(4).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
});

export const datevMappingSchema = z.object({
  category: z.string().min(1).max(200),
  accountNumber: z.string().length(4).regex(/^\d{4}$/, "Kontonummer muss 4 Ziffern haben"),
});

export const datevExportSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
}).refine((d) => d.fromDate <= d.toDate, {
  message: "fromDate muss vor toDate liegen",
});
