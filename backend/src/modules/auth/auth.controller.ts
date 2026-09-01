import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authService } from "./auth.service";
import { loginSchema, registerSchema } from "./auth.validators";
import { buildClearCookieOptions, buildSessionCookieOptions } from "./cookie.config";
import { prisma } from "../../config/prisma";
import { Errors } from "../../utils/AppError";
import { decodeIgnoringExpiration, getExpiryFromToken } from "../../utils/jwt";
import { env } from "../../config/env";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const user = await authService.register(input);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const meta = authService.extractRequestMeta(req);
  const { token, tokenExpiresAt, user } = await authService.login(input, meta);

  res.cookie("access_token", token, buildSessionCookieOptions());
  res.status(200).json({ user, expiresAt: tokenExpiresAt.toISOString() });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.sessionId);
  }
  res.clearCookie("access_token", buildClearCookieOptions());
  res.status(200).json({ message: "Sesión cerrada" });
});

/** Devuelve el usuario autenticado actual (útil para el frontend al recargar). */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw Errors.unauthorized();
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!user) {
    throw Errors.unauthorized();
  }

  const rawToken = req.cookies?.access_token as string | undefined;
  const expiresAt = rawToken ? getExpiryFromToken(rawToken) : null;

  res.status(200).json({ user, expiresAt: expiresAt?.toISOString() ?? null });
});

/**
 * Renueva el JWT dentro de un margen de gracia posterior a su expiración
 * (`SESSION_REFRESH_GRACE_SECONDS`, 60s por defecto). Deliberadamente NO
 * pasa por el middleware `authenticate` (que rechaza tokens expirados sin
 * excepción): este endpoint necesita poder leer un token recién vencido
 * para decidir si todavía está dentro del margen permitido.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.access_token as string | undefined;
  if (!rawToken) {
    throw Errors.unauthorized("No hay sesión para renovar");
  }

  const payload = decodeIgnoringExpiration(rawToken);
  if (!payload) {
    // Firma inválida o token corrupto/manipulado: nunca se renueva.
    throw Errors.unauthorized("Token inválido");
  }

  const graceMs = env.SESSION_REFRESH_GRACE_SECONDS * 1000;
  const msSinceExpiry = Date.now() - payload.exp * 1000;
  if (msSinceExpiry > graceMs) {
    throw Errors.unauthorized("El margen para renovar la sesión ya venció");
  }

  const { token, tokenExpiresAt, user } = await authService.refreshSession(payload.sid);

  res.cookie("access_token", token, buildSessionCookieOptions());
  res.status(200).json({ user, expiresAt: tokenExpiresAt.toISOString() });
});

/**
 * Limpieza forzada: se llama cuando el margen de gracia terminó sin que el
 * usuario renovara la sesión. Revoca la sesión (best-effort) y SIEMPRE
 * limpia la cookie con `Set-Cookie`, para que desaparezca del navegador
 * (DevTools → Application → Cookies) en vez de quedar como una cookie
 * "muerta" pero visible. No requiere `authenticate`: debe poder ejecutarse
 * incluso con un JWT ya vencido más allá del margen de gracia.
 */
export const expireSession = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.access_token as string | undefined;
  await authService.bestEffortRevoke(rawToken);
  res.clearCookie("access_token", buildClearCookieOptions());
  res.status(200).json({ message: "Sesión finalizada por expiración" });
});
