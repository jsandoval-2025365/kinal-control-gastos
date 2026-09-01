import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../config/prisma";
import { Errors } from "../utils/AppError";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Middleware de AUTENTICACIÓN (sección 10: "¿quién es el usuario?").
 *
 * Flujo por cada request protegida:
 *  1. Lee el JWT de la cookie `access_token`.
 *  2. Verifica la firma y expiración del JWT.
 *  3. Busca la sesión (`sid`) en PostgreSQL.
 *  4. Rechaza si la sesión no existe, expiró o fue revocada
 *     — esto es lo que permite que el logout invalide el acceso
 *     INMEDIATAMENTE, incluso si el JWT todavía no expiró.
 *
 * Si todo es válido, puebla `req.user` para que los siguientes
 * middlewares (authorize, ownership) y controllers lo usen.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.access_token as string | undefined;

    if (!token) {
      throw Errors.unauthorized("No hay token de autenticación");
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw Errors.unauthorized("Token inválido o expirado");
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
    });

    const now = new Date();
    if (!session || session.revokedAt !== null || session.expiresAt < now) {
      throw Errors.unauthorized("La sesión no es válida o fue revocada");
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
      sessionId: payload.sid,
    };

    next();
  }
);
