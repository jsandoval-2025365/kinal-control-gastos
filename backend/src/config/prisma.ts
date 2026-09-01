import { PrismaClient } from "@prisma/client";
import { isProd } from "./env";

// Cliente Prisma como singleton para evitar agotar conexiones en dev (hot reload).
export const prisma = new PrismaClient({
  log: isProd ? ["error", "warn"] : ["error", "warn"],
});
