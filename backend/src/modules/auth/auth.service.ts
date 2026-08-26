import { Request } from "express";
import { prisma } from "../../config/prisma";
import { hashPassword, verifyPassword, getDummyHash } from "../../utils/password";
import { signAccessToken } from "../../utils/jwt";
import { Errors } from "../../utils/AppError";
import { env } from "../../config/env";
import { LoginInput, RegisterInput } from "./auth.validators";
import { Role } from "@prisma/client";

const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

export class AuthService {
  /**
   * Registro público. El rol SIEMPRE es USER — no se lee de la petición
   * (regla 12/13: nunca permitir que el registro elija ADMIN).
   */
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // 409 explícito aquí es aceptable: a diferencia del login, el registro
      // no tiene el mismo requisito de anti-enumeración (es una operación
      // de escritura, no de autenticación), y es una UX estándar informar
      // que el email ya está en uso.
      throw Errors.conflict("El email ya está registrado");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: Role.USER,
      },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return user;
  }

  /**
   * Login con mitigación de timing attack / user enumeration (sección 7):
   * SIEMPRE se ejecuta una operación Argon2 (real o "dummy"), y el mensaje
   * de error es idéntico tanto si el usuario no existe como si la
   * contraseña es incorrecta.
   */
  async login(input: LoginInput, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    let passwordValid: boolean;
    if (user) {
      passwordValid = await verifyPassword(user.passwordHash, input.password);
    } else {
      // Ejecuta un verify contra un hash dummy para mantener un tiempo
      // de respuesta similar al caso "usuario existente + password incorrecta".
      const dummyHash = await getDummyHash();
      await verifyPassword(dummyHash, input.password);
      passwordValid = false;
    }

    if (!user || !passwordValid) {
      throw Errors.unauthorized("Credenciales inválidas");
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ipAddress: meta.ipAddress,
      },
    });

    const token = signAccessToken({ sub: user.id, sid: session.id, role: user.role });

    return {
      token,
      session,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  /** Revoca la sesión asociada al request actual (logout, sección 15). */
  async logout(sessionId: string) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoca TODAS las sesiones activas de un usuario. Se usa, por ejemplo,
   * cuando un ADMIN cambia el rol de un usuario (sección 12), para que
   * cualquier JWT emitido con el rol anterior deje de ser válido en el
   * siguiente request (porque la sesión ya no existe/activa).
   */
  async revokeAllSessionsForUser(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  extractRequestMeta(req: Request) {
    return {
      userAgent: req.get("user-agent") ?? undefined,
      ipAddress: req.ip,
    };
  }
}

export const authService = new AuthService();
