import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@chatbot-saas/database";
import { randomUUID } from "node:crypto";

// Este arquivo não sobe o AppModule (é quem normalmente carrega o .env via
// ConfigModule como efeito colateral) — carrega direto, para não depender
// da ordem em que os outros arquivos de teste rodam no mesmo processo
// (`maxWorkers: 1`, ver nota de infraestrutura da Fase 4).
config({ path: resolve(__dirname, "../../../../.env") });

/**
 * Testes de Row-Level Security (Fase 19, ver DEVELOPMENT_PLAN.md e a
 * migration `20260730010000_add_row_level_security`). Diferente do resto
 * da suíte, este arquivo NÃO sobe a aplicação NestJS — conecta direto no
 * Postgres duas vezes: uma vez como "postgres" (dono das tabelas, usado só
 * para semear os dados de teste, já que o dono sempre ignora RLS) e outra
 * vez como "app_runtime" (o papel restrito criado pela migration, sujeito
 * às políticas). O objetivo é provar que a proteção existe NO BANCO,
 * independente de qualquer filtro `WHERE tenantId = ...` escrito em
 * TypeScript — exatamente o cenário que RLS existe para cobrir (um bug de
 * aplicação que esquece o filtro).
 */
describe("Row-Level Security (Fase 19)", () => {
  let owner: PrismaClient;
  let runtime: PrismaClient;
  let tenantAId: string;
  let tenantBId: string;
  let contactAId: string;
  let contactBId: string;

  beforeAll(async () => {
    const runtimeUrl = process.env.DATABASE_RUNTIME_URL;
    if (!runtimeUrl) {
      throw new Error("DATABASE_RUNTIME_URL ausente no .env — necessária para os testes de RLS.");
    }

    owner = new PrismaClient();
    runtime = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
    await owner.$connect();
    await runtime.$connect();

    // Semeia dois tenants com um contato cada, direto como dono (ignora RLS).
    const suffix = randomUUID().slice(0, 8);
    const [tenantA, tenantB] = await Promise.all([
      owner.tenant.create({
        data: {
          razaoSocial: `RLS Tenant A ${suffix}`,
          cnpj: randomCnpj(),
          responsavel: "Responsavel RLS A",
          email: `rls-a-${suffix}@teste.local`,
          subdominio: `rls-a-${suffix}`,
          status: "active",
        },
      }),
      owner.tenant.create({
        data: {
          razaoSocial: `RLS Tenant B ${suffix}`,
          cnpj: randomCnpj(),
          responsavel: "Responsavel RLS B",
          email: `rls-b-${suffix}@teste.local`,
          subdominio: `rls-b-${suffix}`,
          status: "active",
        },
      }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [contactA, contactB] = await Promise.all([
      owner.contact.create({ data: { tenantId: tenantAId, nome: "Contato Tenant A" } }),
      owner.contact.create({ data: { tenantId: tenantBId, nome: "Contato Tenant B" } }),
    ]);
    contactAId = contactA.id;
    contactBId = contactB.id;
  }, 30_000);

  afterAll(async () => {
    await owner.contact.deleteMany({ where: { id: { in: [contactAId, contactBId] } } });
    await owner.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    await owner.$disconnect();
    await runtime.$disconnect();
  });

  async function queryAsTenant<T>(tenantId: string, sql: string): Promise<T> {
    return runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantId}', true)`);
      return tx.$queryRawUnsafe<T>(sql);
    });
  }

  async function queryAsMaster<T>(sql: string): Promise<T> {
    return runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.role', 'master', true)`);
      return tx.$queryRawUnsafe<T>(sql);
    });
  }

  it("sem nenhuma variável de sessão setada, o papel restrito não vê nenhuma linha com tenantId", async () => {
    const rows = await runtime.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM contacts WHERE id IN ('${contactAId}', '${contactBId}')`,
    );
    expect(rows).toHaveLength(0);
  });

  it("com app.tenant_id setado, só enxerga as linhas do próprio tenant — mesmo sem WHERE tenantId no SQL", async () => {
    const rowsAsA = await queryAsTenant<Array<{ id: string; nome: string }>>(
      tenantAId,
      `SELECT id, nome FROM contacts WHERE id IN ('${contactAId}', '${contactBId}')`,
    );
    expect(rowsAsA).toHaveLength(1);
    expect(rowsAsA[0]?.id).toBe(contactAId);
    expect(rowsAsA[0]?.nome).toBe("Contato Tenant A");

    const rowsAsB = await queryAsTenant<Array<{ id: string; nome: string }>>(
      tenantBId,
      `SELECT id, nome FROM contacts WHERE id IN ('${contactAId}', '${contactBId}')`,
    );
    expect(rowsAsB).toHaveLength(1);
    expect(rowsAsB[0]?.id).toBe(contactBId);
  });

  it("um UPDATE tentando gravar em outro tenant (bug de aplicação hipotético) não afeta nenhuma linha", async () => {
    const result = await runtime.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', '${tenantAId}', true)`);
      return tx.$executeRawUnsafe(`UPDATE contacts SET nome = 'Sequestrado' WHERE id = '${contactBId}'`);
    });
    expect(result).toBe(0); // nenhuma linha afetada — a política bloqueou

    const stillIntact = await owner.contact.findUniqueOrThrow({ where: { id: contactBId } });
    expect(stillIntact.nome).toBe("Contato Tenant B");
  });

  it("com app.role = 'master', enxerga linhas de todos os tenants (fluxo do Painel Master/scheduler)", async () => {
    const rows = await queryAsMaster<Array<{ id: string }>>(
      `SELECT id FROM contacts WHERE id IN ('${contactAId}', '${contactBId}')`,
    );
    expect(rows).toHaveLength(2);
  });

  it("o papel dono ('postgres', usado só por Prisma Migrate) sempre ignora RLS — não é o papel de runtime da aplicação", async () => {
    const rows = await owner.contact.findMany({ where: { id: { in: [contactAId, contactBId] } } });
    expect(rows).toHaveLength(2);
  });
});

function randomCnpj(): string {
  return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
}
