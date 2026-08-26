import { z } from "zod";
import { Role } from "@prisma/client";

export const changeRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(5000),
});
