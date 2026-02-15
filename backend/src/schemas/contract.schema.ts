import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const contractQuerySchema = paginationSchema.extend({
  status: z.enum(["AKTIV", "GEKUENDIGT", "AUSLAUFEND", "ENTWURF"]).optional(),
  type: z.enum(["WOHNRAUM", "GEWERBE", "STAFFEL", "INDEX"]).optional(),
  propertyId: z.coerce.number().int().positive().optional(),
});

export const createContractSchema = z.object({
  type: z.enum(["WOHNRAUM", "GEWERBE", "STAFFEL", "INDEX"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().default(null),
  noticePeriod: z.number().int().min(0).default(3),
  monthlyRent: z.number().positive(),
  deposit: z.number().min(0).default(0),
  status: z.enum(["AKTIV", "GEKUENDIGT", "AUSLAUFEND", "ENTWURF"]).default("ENTWURF"),
  nextReminder: z.coerce.date().nullable().optional(),
  reminderType: z.enum(["KUENDIGUNGSFRIST", "VERTRAGSVERLAENGERUNG", "MIETANPASSUNG", "KAUTIONSRUECKZAHLUNG"]).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  tenantId: z.number().int().positive(),
  propertyId: z.number().int().positive(),
  unitId: z.number().int().positive(),
});

export const updateContractSchema = createContractSchema.partial();
