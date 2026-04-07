import { z } from "zod";

// POST /verify-2fa  (mfaToken im Authorization-Header)
export const verify2faSchema = z.object({
  code: z
    .string()
    .length(6, "Code muss genau 6 Ziffern haben")
    .regex(/^\d{6}$/, "Code darf nur Ziffern enthalten"),
  rememberDevice: z.boolean().optional(),
});

// POST /me/2fa/confirm
export const confirm2faSchema = z.object({
  code: z
    .string()
    .length(6, "Code muss genau 6 Ziffern haben")
    .regex(/^\d{6}$/, "Code darf nur Ziffern enthalten"),
});

// DELETE /me/2fa
export const disable2faSchema = z.object({
  password: z.string().min(1, "Passwort darf nicht leer sein"),
});

export type Verify2faInput = z.infer<typeof verify2faSchema>;
export type Confirm2faInput = z.infer<typeof confirm2faSchema>;
export type Disable2faInput = z.infer<typeof disable2faSchema>;
