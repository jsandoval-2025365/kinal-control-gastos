import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authService } from "./auth.service";
import { loginSchema, registerSchema } from "./auth.validators";
import { buildClearCookieOptions, buildSessionCookieOptions } from "./cookie.config";
import { prisma } from "../../config/prisma";
import { Errors } from "../../utils/AppError";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const user = await authService.register(input);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const meta = authService.extractRequestMeta(req);
  const { token, user } = await authService.login(input, meta);

  res.cookie("access_token", token, buildSessionCookieOptions());
  res.status(200).json({ user });
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
  res.status(200).json({ user });
});
