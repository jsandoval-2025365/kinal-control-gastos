import { Router } from "express";
import * as authController from "./auth.controller";
import { authenticate } from "../../middleware/authenticate";
import { authRateLimiter } from "../../middleware/rateLimiter";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, authController.register);
authRouter.post("/login", authRateLimiter, authController.login);
authRouter.post("/logout", authenticate, authController.logout);
authRouter.get("/me", authenticate, authController.me);
