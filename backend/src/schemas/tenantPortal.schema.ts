import { z } from "zod";

export const tenantPortalIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateMeSchema = z.object({
  phone: z.string().max(30).optional(),
});

export const MAINTENANCE_CATEGORIES = [
  "SANITAER",
  "ELEKTRIK",
  "HEIZUNG",
  "GEBAEUDE",
  "AUSSENANLAGE",
  "SONSTIGES",
] as const;

export type MaintenanceCategoryType = (typeof MAINTENANCE_CATEGORIES)[number];

export const createTicketSchema = z.object({
  title: z.string().min(3, "Titel muss mindestens 3 Zeichen lang sein").max(200),
  description: z.string().min(10, "Beschreibung muss mindestens 10 Zeichen lang sein").max(2000),
  category: z.enum(MAINTENANCE_CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Ungültige Kategorie" }),
  }),
});

export const createMessageSchema = z.object({
  body: z.string().min(1, "Nachricht darf nicht leer sein").max(5000),
});

export const signDocumentSchema = z.object({
  type: z.enum(["SIMPLE", "SIGNATURE_PAD"]),
  signatureData: z.string().optional(),
});

export const uploadMetaSchema = z.object({
  category: z.string().default("Sonstiges"),
  description: z.string().max(500).optional(),
});
