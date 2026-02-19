import { z } from "zod";
import { paginationSchema } from "./common.schema.js";

export const maintenanceQuerySchema = paginationSchema.extend({
  status: z.enum(["OFFEN", "IN_BEARBEITUNG", "WARTEND", "ERLEDIGT"]).optional(),
  priority: z.enum(["NIEDRIG", "MITTEL", "HOCH", "DRINGEND"]).optional(),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]).optional(),
  propertyId: z.coerce.number().int().positive().optional(),
});

export const createMaintenanceSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).default(""),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]),
  priority: z.enum(["NIEDRIG", "MITTEL", "HOCH", "DRINGEND"]),
  unitLabel: z.string().max(100).default("Allgemein"),
  reportedBy: z.string().max(200).default("Hausverwaltung"),
  assignedTo: z.string().max(200).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  cost: z.number().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  propertyId: z.number().int().positive(),
  unitId: z.number().int().positive().nullable().optional(),
});

export const updateMaintenanceSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]).optional(),
  priority: z.enum(["NIEDRIG", "MITTEL", "HOCH", "DRINGEND"]).optional(),
  status: z.enum(["OFFEN", "IN_BEARBEITUNG", "WARTEND", "ERLEDIGT"]).optional(),
  unitLabel: z.string().max(100).optional(),
  reportedBy: z.string().max(200).optional(),
  assignedTo: z.string().max(200).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  cost: z.number().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
