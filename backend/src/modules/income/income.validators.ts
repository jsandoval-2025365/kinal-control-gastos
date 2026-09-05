import { z } from "zod";
import { IncomeFrequency } from "@prisma/client";

const amountSchema = z
  .number({ invalid_type_error: "El monto debe ser un número" })
  .positive("El monto debe ser mayor a 0")
  .finite("El monto no es válido")
  .max(999_999_999.99, "El monto es demasiado alto");

const sourceSchema = z
  .string()
  .trim()
  .min(1, "La fuente de ingreso es requerida")
  .max(100, "La fuente de ingreso es demasiado larga");

const dateSchema = z.coerce.date({
  errorMap: () => ({ message: "Fecha inválida" }),
});

export const createIncomeSchema = z.object({
  source: sourceSchema,
  amount: amountSchema,
  frequency: z.nativeEnum(IncomeFrequency),
  date: dateSchema,
});

// Update parcial: cualquier subconjunto de los campos, pero al menos uno.
export const updateIncomeSchema = z
  .object({
    source: sourceSchema.optional(),
    amount: amountSchema.optional(),
    frequency: z.nativeEnum(IncomeFrequency).optional(),
    date: dateSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debes enviar al menos un campo para actualizar",
  });

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;