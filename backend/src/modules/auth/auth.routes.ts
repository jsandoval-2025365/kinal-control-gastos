import { Router } from "express";
import * as authController from "./auth.controller";
import { authenticate } from "../../middleware/authenticate";
import { authRateLimiter } from "../../middleware/rateLimiter";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, authController.register);
authRouter.post("/login", authRateLimiter, authController.login);
authRouter.post("/logout", authenticate, authController.logout);
authRouter.get("/me", authenticate, authController.me);

// `refresh` y `session-expire` NO pasan por `authenticate` a propósito:
// ambas rutas necesitan poder operar con un JWT que ya expiró (ver
// auth.controller.ts para el porqué). El rate limiter evita que alguien
// abuse de `/refresh` intentando forzar renovaciones repetidas.
authRouter.post("/refresh", authRateLimiter, authController.refresh);
authRouter.post("/session-expire", authController.expireSession);
