import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "@prisma/client";

/**
 * Payload del JWT. Deliberadamente mínimo (sección 5): solo lo necesario
 * para identificar al usuario y su sesión. NUNCA se incluyen contraseñas,
 * hashes ni datos sensibles.
 *
 * El JWT se firma con HS256 (HMAC-SHA256) usando JWT_SECRET. Está FIRMADO,
 * no cifrado: cualquiera puede leer su contenido en base64, pero no puede
 * modificarlo sin invalidar la firma.
 */
export interface JwtPayload {
  sub: string; // userId
  sid: string; // sessionId (permite revocación real en PostgreSQL)
  role: Role;
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

export function signAccessToken(payload: JwtPayload): SignedToken {
  const options: jwt.SignOptions = {
    algorithm: "HS256",
    // @types/jsonwebtoken tipa expiresIn como `number | StringValue`
    // (un tipo "branded" de la librería `ms`). Nuestro valor viene de
    // una variable de entorno validada por Zod como `string` genérico,
    // así que se castea aquí explícitamente — el valor sigue validándose
    // en runtime por la propia librería `jsonwebtoken`.
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  const token = jwt.sign(payload, env.JWT_SECRET, options);
  const decoded = jwt.decode(token) as (JwtPayload & { exp: number }) | null;
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date();
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): JwtPayload {
  // Lanza si la firma es inválida o el token expiró.
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}

/** Lee la fecha de expiración de un token que ya sabemos válido (post-authenticate). */
export function getExpiryFromToken(token: string): Date | null {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ? new Date(decoded.exp * 1000) : null;
}

/**
 * Verifica la FIRMA del JWT sin rechazar por expiración. Se usa
 * exclusivamente en el flujo de renovación (`/auth/refresh`) y de limpieza
 * forzada (`/auth/session-expire`), donde deliberadamente necesitamos leer
 * un token recién expirado para saber a qué sesión pertenece. La firma
 * sigue verificándose igual: un token manipulado o con secreto incorrecto
 * devuelve `null` de todas formas.
 */
export function decodeIgnoringExpiration(
  token: string
): (JwtPayload & { exp: number }) | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      ignoreExpiration: true,
    }) as JwtPayload & { exp: number };
  } catch {
    return null;
  }
}
