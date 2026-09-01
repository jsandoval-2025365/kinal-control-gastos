import { prisma } from "../src/config/prisma";

/**
 * Limpia las tablas relevantes entre tests. Requiere que DATABASE_URL
 * apunte a una base de datos de PRUEBAS (nunca a producción).
 */
export async function resetDatabase() {
  await prisma.note.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnect() {
  await prisma.$disconnect();
}
