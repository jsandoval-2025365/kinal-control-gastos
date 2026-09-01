/**
 * Seed controlado para crear el primer usuario ADMIN.
 * Nunca se expone como endpoint público (sección 14).
 *
 * Uso:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=CambiaEsto123! pnpm prisma:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios para el seed. Abortando."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`El usuario ${email} ya existe. No se realizan cambios.`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Usuario ADMIN creado: ${admin.email} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
