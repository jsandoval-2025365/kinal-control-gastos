import { CookieOptions } from "express";
import { env, isProd } from "../../config/env";

/**
 * Configuración de la cookie de sesión (sección 6):
 * - HttpOnly: JS del navegador no puede leerla → mitiga robo vía XSS.
 * - Secure: solo se envía sobre HTTPS (en dev con NODE_ENV=development se
 *   relaja para poder probar en http://localhost).
 * - SameSite=Lax: evita que la cookie se envíe en la mayoría de peticiones
 *   cross-site (mitigación adicional de CSRF), sin romper navegación normal.
 * - Path=/: disponible en toda la API.
 * - maxAge: coherente con la duración de la sesión en PostgreSQL.
 */
export function buildSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };
}

export function buildClearCookieOptions(): CookieOptions {
  const { maxAge, ...rest } = buildSessionCookieOptions();
  return rest;
}
