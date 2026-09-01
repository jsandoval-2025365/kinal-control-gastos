import { prisma } from "../../config/prisma";
import { Errors } from "../../utils/AppError";
import { Role } from "@prisma/client";
import { authService } from "../auth/auth.service";

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw Errors.notFound("Usuario no encontrado");
    return user;
  }

  /** Solo ADMIN. Lista todos los usuarios (sección 9). */
  async listUsers() {
    return prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Solo ADMIN. Cambia el rol de un usuario. Revoca todas sus sesiones
   * activas para que el cambio de privilegios surta efecto de inmediato
   * (sección 12) — un JWT viejo con el rol anterior deja de servir porque
   * la sesión asociada ya no es válida.
   */
  async changeUserRole(targetUserId: string, newRole: Role) {
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw Errors.notFound("Usuario no encontrado");

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });

    await authService.revokeAllSessionsForUser(targetUserId);

    return updated;
  }

  /**
   * Demuestra control de propiedad de recursos (sección 13): un usuario
   * solo puede leer sus propias notas, salvo que sea ADMIN.
   */
  async getNoteForUser(noteId: string, requester: { id: string; role: Role }) {
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw Errors.notFound("Nota no encontrada");

    const isOwner = note.userId === requester.id;
    const isAdmin = requester.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      // 403, no 404: existe pero no tienes permiso. (Se puede usar 404
      // en su lugar si se prefiere no revelar existencia; aquí se opta
      // por 403 por claridad, ya que el ID no es adivinable de forma trivial —
      // documentar esta decisión si el modelo de amenaza exige lo contrario.)
      throw Errors.forbidden("No tienes acceso a este recurso");
    }

    return note;
  }

  async listNotesForUser(userId: string) {
    return prisma.note.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async createNote(userId: string, data: { title: string; content: string }) {
    return prisma.note.create({ data: { ...data, userId } });
  }
}

export const userService = new UserService();
