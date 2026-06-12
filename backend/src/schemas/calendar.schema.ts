import { z } from "zod";

export const REMINDER_PRESETS = [60, 1440, 4320, 10080] as const; // 1h, 1d, 3d, 1w

const recurrenceFreqSchema = z.enum(["TAEGLICH", "WOECHENTLICH", "MONATLICH", "JAEHRLICH"]);

const reminderMinutesSchema = z
  .number()
  .refine((v): v is (typeof REMINDER_PRESETS)[number] => (REMINDER_PRESETS as readonly number[]).includes(v), {
    message: "Erinnerung muss 60, 1440, 4320 oder 10080 Minuten sein",
  });

const sharedEventFields = {
  description: z.string().max(2000).nullish(),
  end: z.coerce.date().nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  recurrenceFreq: recurrenceFreqSchema.nullish(),
  recurrenceInterval: z.number().int().min(1).max(99).optional(),
  recurrenceUntil: z.coerce.date().nullish(),
  reminderMinutes: reminderMinutesSchema.nullish(),
  propertyId: z.number().int().positive().nullish(),
  tenantId: z.number().int().positive().nullish(),
  visitorName: z.string().max(200).nullish(),
  visitorContact: z.string().max(200).nullish(),
};

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(200),
  start: z.coerce.date(),
  allDay: z.boolean().default(false),
  type: z.enum(["MANUELL", "BESICHTIGUNG"]).optional(),
  ...sharedEventFields,
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  start: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  ...sharedEventFields,
});

export const calendarQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
