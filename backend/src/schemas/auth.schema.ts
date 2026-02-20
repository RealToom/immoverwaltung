import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(200),
  email: z.string().email("Ungueltige E-Mail-Adresse").max(320),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Passwort muss mind. 1 Gross-/Kleinbuchstaben und 1 Ziffer enthalten"
    ),
  companyName: z.string().min(1, "Firmenname ist erforderlich").max(300),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse").max(320),
  password: z.string().min(1, "Passwort ist erforderlich").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional(),
  bio: z.string().max(2000).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich").max(128),
  newPassword: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Passwort muss mind. 1 Gross-/Kleinbuchstaben und 1 Ziffer enthalten"
    ),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateNotificationPrefsSchema = z.object({
  emailVertrag: z.boolean().optional(),
  emailWartung: z.boolean().optional(),
  emailFinanzen: z.boolean().optional(),
  pushVertrag: z.boolean().optional(),
  pushWartung: z.boolean().optional(),
  pushFinanzen: z.boolean().optional(),
  reminderDays: z.number().int().min(1).max(90).optional(),
  digestFrequency: z.enum(["TAEGLICH", "WOECHENTLICH", "MONATLICH"]).optional(),
});

export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
