import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 29 (ver DEVELOPMENT_PLAN.md): exportação CSV nas 4 áreas do Master e
 * o indicador de acesso assistido ativo na lista de Empresas. Arquivo
 * próprio (não dentro de `master-panel.spec.ts`, que já soma vários
 * cadastros de tenant) para não esbarrar no throttle de
 * `POST /auth/tenant/signup` (5/60s por instância da app).
 */
describe("Master — Fase 29", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@master29-test.local`;
    const senha = "SenhaDeTeste123";
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/tenant/signup").send({
      razaoSocial: `Empresa ${label} ${suffix}`,
      cnpj: randomCnpj(),
      responsavel: `Responsavel ${label}`,
      email,
      confirmacaoEmail: email,
      senha,
      confirmacaoSenha: senha,
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("exporta CSV de empresas, planos, afiliados e usuários Master", async () => {
    const endpoints = ["/master/tenants/export", "/master/plans/export", "/master/affiliates/export", "/master/master-users/export"];
    for (const endpoint of endpoints) {
      const res = await superAdmin.get(endpoint);
      expect(res.status).toBe(200);
      expect(res.header["content-type"]).toContain("text/csv");
      expect(res.header["content-disposition"]).toContain("attachment");
      expect(res.text.split("\n")[0]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("indica na lista de empresas quando um tenant está sob acesso assistido, e some após logout da sessão de impersonação", async () => {
    const tenant = await signupTenant("badge");

    const before = await superAdmin.get("/master/tenants");
    const beforeRow = before.body.find((t: { id: string }) => t.id === tenant.tenantId);
    expect(beforeRow.impersonationActive).toBe(false);

    const impersonate = await superAdmin.post(`/master/tenants/${tenant.tenantId}/impersonate`).send({ accessLevel: "read" });
    expect(impersonate.status).toBe(200);

    const during = await superAdmin.get("/master/tenants");
    const duringRow = during.body.find((t: { id: string }) => t.id === tenant.tenantId);
    expect(duringRow.impersonationActive).toBe(true);

    // O cookie de impersonação foi setado na resposta da própria chamada
    // acima — fica no cookie jar do agente `superAdmin` (mesmo "navegador"
    // do master, cookie de tenant e de master coexistem por terem nomes
    // diferentes), não no do tenant original.
    await superAdmin.post("/auth/tenant/logout");

    const after = await superAdmin.get("/master/tenants");
    const afterRow = after.body.find((t: { id: string }) => t.id === tenant.tenantId);
    expect(afterRow.impersonationActive).toBe(false);
  });
});
