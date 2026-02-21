import { z } from "zod";

export const createScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  category: z.enum(["SANITAER", "ELEKTRIK", "HEIZUNG", "GEBAEUDE", "AUSSENANLAGE", "SONSTIGES"]),
  interval: z.enum(["MONATLICH", "VIERTELJAEHRLICH", "HALBJAEHRLICH", "JAEHRLICH"]),
  nextDue: z.string().datetime(),
  assignedTo: z.string().optional(),
  propertyId: z.number().int(),
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  assignedTo: z.string().optional(),
  isActive: z.boolean().optional(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional(),
});
