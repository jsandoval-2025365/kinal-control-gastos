import { Router } from "express";
import * as userController from "./user.controller";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { Role } from "@prisma/client";

export const userRouter = Router();
export const adminRouter = Router();
export const noteRouter = Router();

// --- Recursos de usuario normal (requieren solo autenticación) ---
userRouter.get("/profile", authenticate, userController.getMyProfile);

// --- Recursos administrativos (requieren autenticación + rol ADMIN) ---
adminRouter.get("/users", authenticate, authorize(Role.ADMIN), userController.listUsers);
adminRouter.patch(
  "/users/:id/role",
  authenticate,
  authorize(Role.ADMIN),
  userController.changeUserRole
);

// --- Recursos con control de propiedad (demo IDOR, sección 13) ---
noteRouter.get("/:id", authenticate, userController.getNote);
noteRouter.get("/", authenticate, userController.listMyNotes);
noteRouter.post("/", authenticate, userController.createNote);
