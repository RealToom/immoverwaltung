import { z } from "zod";

export const tenantLoginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort darf nicht leer sein"),
});

export const tenantAcceptInviteSchema = z.object({
  token: z.string().min(1, "Token fehlt"),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten"),
});

export type TenantLoginInput = z.infer<typeof tenantLoginSchema>;
export type TenantAcceptInviteInput = z.infer<typeof tenantAcceptInviteSchema>;
