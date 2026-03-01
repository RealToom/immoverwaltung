// backend/src/schemas/import.schema.ts
import { z } from "zod";

// Helper: DD.MM.YYYY oder YYYY-MM-DD → Date
const deDate = z.string().transform((val, ctx) => {
  let d: Date;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [day, month, year] = val.split(".");
    d = new Date(`${year}-${month}-${day}`);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
    return z.NEVER;
  }
  return d;
});

export const importPropertyRowSchema = z.object({
  Immobilie_Name: z.string().min(1).max(300),
  Strasse: z.string().min(1).max(300),
  PLZ: z.string().min(1).max(10),
  Stadt: z.string().min(1).max(200),
  Einheit_Nummer: z.string().min(1).max(50),
  Einheit_Etage: z.coerce.number().int(),
  Flaeche_m2: z.coerce.number().positive(),
  Kaltmiete_EUR: z.coerce.number().min(0),
  Einheit_Typ: z.enum(["WOHNUNG", "GARAGE", "STELLPLATZ"]).default("WOHNUNG"),
});

export const importPropertyRowsSchema = z.array(importPropertyRowSchema).min(1);

export const importTenantRowSchema = z.object({
  Name: z.string().min(1).max(200),
  Email: z.string().email().max(320),
  Telefon: z.string().max(50).default(""),
  Einzugsdatum: deDate,
});

export const importTenantRowsSchema = z.array(importTenantRowSchema).min(1);

export const importContractRowSchema = z.object({
  Mieter_Name: z.string().min(1),
  Immobilie_Name: z.string().min(1),
  Einheit_Nummer: z.string().min(1),
  Typ: z.enum(["WOHNRAUM", "GEWERBE", "STAFFEL", "INDEX"]),
  Mietbeginn: deDate,
  Mietende: z.string().transform((val, ctx) => {
    if (!val || val.trim() === "") return null;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
      const [day, month, year] = val.split(".");
      const d = new Date(`${year}-${month}-${day}`);
      if (isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
        return z.NEVER;
      }
      return d;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Ungültiges Datum: ${val}` });
      return z.NEVER;
    }
    return d;
  }).nullable(),
  Kaltmiete_EUR: z.coerce.number().positive(),
  Kaution_EUR: z.coerce.number().min(0).default(0),
  Status: z.enum(["AKTIV", "ENTWURF", "GEKUENDIGT"]).default("AKTIV"),
});

export const importContractRowsSchema = z.array(importContractRowSchema).min(1);
