import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.MASTER_SEED_EMAIL;
  const password = process.env.MASTER_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "MASTER_SEED_EMAIL e MASTER_SEED_PASSWORD são obrigatórios (ver .env.example) — " +
        "não criamos um MasterUser inicial com credencial previsível.",
    );
  }

  const existing = await prisma.masterUser.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`MasterUser ${email} já existe — nada a fazer.`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.masterUser.create({
    data: {
      nome: "Administrador",
      email,
      passwordHash,
      role: "super_admin",
      status: "active",
    },
  });

  // eslint-disable-next-line no-console
  console.log(`MasterUser inicial criado: ${email}`);
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
