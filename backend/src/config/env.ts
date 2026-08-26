import "dotenv/config";
import { z } from "zod";

/**
 * Valida y tipa las variables de entorno al arrancar la app.
 * Si falta alguna, el proceso falla rápido (fail-fast) en vez de
 * comportarse de forma indefinida en producción.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  CSRF_SECRET: z.string().min(32, "CSRF_SECRET debe tener al menos 32 caracteres"),
  CORS_ORIGIN: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
