import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { Errors } from "../utils/AppError";

/**
 * Middleware de AUTORIZACIÓN (sección 10: "¿qué puede hacer?").
 * Se coloca DESPUÉS de `authenticate` en la cadena de middlewares.
 * Centraliza el chequeo de rol para no duplicarlo en cada controller
 * (sección 11).
 *
 * Uso: router.get('/admin/users', authenticate, authorize('ADMIN'), handler)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw Errors.unauthorized();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw Errors.forbidden("No tienes permisos para realizar esta acción");
    }
    next();
  };
}
