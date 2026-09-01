import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { userService } from "./user.service";
import { changeRoleSchema, createNoteSchema } from "./user.validators";
import { Errors } from "../../utils/AppError";

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getProfile(req.user!.id);
  res.status(200).json({ user });
});

/** GET /api/admin/users — solo ADMIN */
export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await userService.listUsers();
  res.status(200).json({ users });
});

/** PATCH /api/admin/users/:id/role — solo ADMIN */
export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { role } = changeRoleSchema.parse(req.body);
  const { id } = req.params;

  if (id === req.user!.id) {
    // Evita que un admin se auto-revoque por accidente y quede sin acceso,
    // y evita cualquier ambigüedad sobre "un usuario modificando su propio rol".
    throw Errors.badRequest("No puedes cambiar tu propio rol");
  }

  const updated = await userService.changeUserRole(id, role);
  res.status(200).json({ user: updated });
});

/** GET /api/notes/:id — dueño del recurso o ADMIN (demo de sección 13) */
export const getNote = asyncHandler(async (req: Request, res: Response) => {
  const note = await userService.getNoteForUser(req.params.id, req.user!);
  res.status(200).json({ note });
});

export const listMyNotes = asyncHandler(async (req: Request, res: Response) => {
  const notes = await userService.listNotesForUser(req.user!.id);
  res.status(200).json({ notes });
});

export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const input = createNoteSchema.parse(req.body);
  const note = await userService.createNote(req.user!.id, input);
  res.status(201).json({ note });
});
