import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { userRouter, adminRouter, noteRouter } from "./modules/users/user.routes";
import { errorHandler } from "./middleware/errorHandler";
import { generateToken, doubleCsrfProtection } from "./config/csrf";

export function createApp() {
  const app = express();

  // Headers de seguridad (sección 16): CSP, X-Frame-Options, HSTS, etc.
  app.use(helmet());

  // CORS: el frontend (Angular) corre en otro origen y necesita enviar
  // cookies, por eso `credentials: true` + origin explícito (nunca "*").
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  // Endpoint para que el frontend obtenga un token CSRF antes de mutar datos.
  app.get("/api/csrf-token", (req, res) => {
    const token = generateToken(req, res);
    res.json({ csrfToken: token });
  });

  // Protección CSRF para todo lo que mute estado, excepto login/register
  // (donde todavía no existe sesión autenticada que un atacante pueda
  // aprovechar vía CSRF de la misma forma; se protegen igualmente por
  // rate limiting). Se aplica a partir de aquí para el resto de rutas.
  app.use("/api/auth/logout", doubleCsrfProtection);
  app.use("/api/admin", doubleCsrfProtection);
  app.use("/api/notes", doubleCsrfProtection);

  app.use("/api/auth", authRouter);
  app.use("/api/users", userRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/notes", noteRouter);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // 404 para rutas no definidas
  app.use((req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  // Manejador de errores centralizado — SIEMPRE al final.
  app.use(errorHandler);

  return app;
}
