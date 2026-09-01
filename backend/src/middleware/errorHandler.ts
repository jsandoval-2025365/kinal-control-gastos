import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { isProd } from "../config/env";
import { ZodError } from "zod";

/**
 * Manejo centralizado de errores (sección 18).
 * - Nunca expone stack traces, hashes, secretos o detalles de Prisma en producción.
 * - Usa el código HTTP correcto según el tipo de error.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos inválidos",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Error no controlado: log interno completo, respuesta genérica al cliente.
  console.error("Error no controlado:", err);

  return res.status(500).json({
    error: "Error interno del servidor",
    ...(isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
}
