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

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  // Lanza si la firma es inválida o el token expiró.
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}
