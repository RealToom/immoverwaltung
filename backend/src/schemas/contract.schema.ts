import { z } from "zod";
import { paginationSchema } from "./common.schema.js";
import { isKautionValid, MAX_KAUTION_MONATE } from "../lib/mietrecht.js";

export const contractQuerySchema = paginationSchema.extend({
  status: z.enum(["AKTIV", "GEKUENDIGT", "AUSLAUFEND", "ENTWURF"]).optional(),
  type: z.enum(["WOHNRAUM", "GEWERBE", "STAFFEL", "INDEX"]).optional(),
  propertyId: z.coerce.number().int().positive().optional(),
});

const contractObject = z.object({
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

// § 551 Abs. 1 BGB: Kaution höchstens drei Nettokaltmieten. Greift nur, wenn
// beide Werte vorliegen (bei Teil-Updates dürfen einzelne Felder fehlen).
const kautionRefinement = (d: { deposit?: number; monthlyRent?: number }) =>
  d.deposit == null || d.monthlyRent == null || isKautionValid(d.deposit, d.monthlyRent);
const kautionError = {
  message: `Die Kaution darf höchstens ${MAX_KAUTION_MONATE} Nettokaltmieten betragen (§ 551 Abs. 1 BGB).`,
  path: ["deposit"],
};

export const createContractSchema = contractObject.refine(kautionRefinement, kautionError);
export const updateContractSchema = contractObject.partial().refine(kautionRefinement, kautionError);
