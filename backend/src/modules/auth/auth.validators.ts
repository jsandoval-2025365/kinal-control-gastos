import { z } from "zod";

/**
 * Validación en backend (fuente definitiva, sección 17). El frontend
 * replica reglas equivalentes solo para UX, nunca como control de seguridad.
 *
 * Nota: el schema de registro NO acepta un campo `role`. Cualquier valor
 * enviado en el body para `role` es ignorado por diseño (sección 9/12).
 */
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .max(128, "La contraseña es demasiado larga"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  password: z.string().min(1, "La contraseña es requerida").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
