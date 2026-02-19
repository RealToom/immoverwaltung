import { z } from "zod";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(300),
  password: z.string().min(8).max(100).regex(
    passwordRegex,
    "Passwort muss Gross-/Kleinbuchstaben und eine Zahl enthalten"
  ),
  role: z.enum(["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"]).default("VERWALTER"),
  phone: z.string().max(50).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["ADMIN", "VERWALTER", "BUCHHALTER", "READONLY"]).optional(),
  phone: z.string().max(50).optional(),
});
