import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração da Fase 2 — Painel Master (planos, empresas,
 * usuários Master e acesso assistido). Rodam contra a infraestrutura real
 * de desenvolvimento (mesmo padrão de tenant-isolation.spec.ts).
 */
describe("Painel Master (Fase 2)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let featureTenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) {
      throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@master-test.local`;
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
    if (res.status !== 201) {
      throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) {
      throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env — necessários para os testes.");
    }
    superAdmin = await loginMaster(seedEmail, seedPassword);
    // Compartilhado entre os 3 primeiros testes (plano/módulo/status não
    // interferem entre si) para não esbarrar no rate limit de signup
    // (5 requisições/60s — ver SECURITY.md §1), a mesma proteção real
    // exercitada (não contornada) em tenant-isolation.spec.ts.
    featureTenant = await signupTenant("feature");
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("cria e atualiza um plano (super_admin)", async () => {
    const nome = `Plano Teste ${randomUUID().slice(0, 8)}`;
    const create = await superAdmin.post("/master/plans").send({
      nome,
      preco: 199.9,
      recorrencia: "mensal",
      modulos: ["crm", "whatsapp"],
      limites: { usuarios: 10, numerosWhatsapp: 1 },
    });
    expect(create.status).toBe(201);
    expect(create.body.ativo).toBe(true);

    const update = await superAdmin.patch(`/master/plans/${create.body.id}`).send({ preco: 249.9 });
    expect(update.status).toBe(200);
    expect(Number(update.body.preco)).toBeCloseTo(249.9);
  });

  it("atribui plano a um tenant e cria assinatura ativa", async () => {
    const plan = await superAdmin.post("/master/plans").send({
      nome: `Plano Atribuição ${randomUUID().slice(0, 8)}`,
      preco: 99,
      recorrencia: "mensal",
      modulos: ["crm"],
      limites: { usuarios: 5 },
    });
    const tenant = featureTenant;

    const assign = await superAdmin.patch(`/master/tenants/${tenant.tenantId}/plan`).send({ planId: plan.body.id });
    expect(assign.status).toBe(200);
    expect(assign.body.planId).toBe(plan.body.id);

    const detail = await superAdmin.get(`/master/tenants/${tenant.tenantId}`);
    expect(detail.body.plan.id).toBe(plan.body.id);
    expect(detail.body.subscriptions[0].status).toBe("active");
  });

  it("ativa módulo via Master e o tenant enxerga em /tenants/me/features", async () => {
    const tenant = featureTenant;

    const toggle = await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "crm", enabled: true });
    expect(toggle.status).toBe(200);
    expect(toggle.body.enabled).toBe(true);

    const features = await tenant.agent.get("/tenants/me/features");
    expect(features.body).toContainEqual({ module: "crm", enabled: true });
  });

  it("muda status do tenant preservando os dados (nunca apaga)", async () => {
    const tenant = featureTenant;

    const block = await superAdmin.patch(`/master/tenants/${tenant.tenantId}/status`).send({ status: "blocked" });
    expect(block.status).toBe(200);
    expect(block.body.status).toBe("blocked");

    // Dados do tenant continuam intactos e acessíveis pelo Master.
    const stillThere = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.tenantId } });
    expect(stillThere.id).toBe(tenant.tenantId);

    const reactivate = await superAdmin.patch(`/master/tenants/${tenant.tenantId}/status`).send({ status: "active" });
    expect(reactivate.body.status).toBe("active");
  });

  it("papel suporte não pode criar plano (403) mas pode listar empresas", async () => {
    const email = `suporte-${randomUUID().slice(0, 8)}@master-test.local`;
    const created = await superAdmin.post("/master/master-users").send({
      nome: "Usuário Suporte",
      email,
      senha: "SenhaDeTeste123",
      role: "suporte",
    });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty("passwordHash");

    const suporte = await loginMaster(email, "SenhaDeTeste123");

    const forbidden = await suporte.post("/master/plans").send({
      nome: "Não deveria criar",
      preco: 10,
      recorrencia: "mensal",
      modulos: [],
      limites: {},
    });
    expect(forbidden.status).toBe(403);

    const allowed = await suporte.get("/master/tenants");
    expect(allowed.status).toBe(200);
  });

  it("acesso assistido: suporte só consegue impersonar em modo leitura, mesmo pedindo read_write", async () => {
    const tenant = await signupTenant("impersonate-suporte");
    const email = `suporte2-${randomUUID().slice(0, 8)}@master-test.local`;
    await superAdmin.post("/master/master-users").send({
      nome: "Suporte Dois",
      email,
      senha: "SenhaDeTeste123",
      role: "suporte",
    });
    const suporte = await loginMaster(email, "SenhaDeTeste123");

    const impersonate = await suporte
      .post(`/master/tenants/${tenant.tenantId}/impersonate`)
      .send({ accessLevel: "read_write" });
    expect(impersonate.status).toBe(200);
    expect(impersonate.body.accessLevel).toBe("read");

    // Leitura funciona.
    const read = await suporte.get("/tenants/me");
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(tenant.tenantId);

    // Escrita é bloqueada mesmo com Permission válida (papel admin do tenant).
    const write = await suporte.patch(`/tenant-users/${tenant.userId}`).send({ nome: "Tentativa bloqueada" });
    expect(write.status).toBe(403);
  });

  it("acesso assistido: financeiro não pode impersonar", async () => {
    const tenant = await signupTenant("impersonate-financeiro");
    const email = `financeiro-${randomUUID().slice(0, 8)}@master-test.local`;
    await superAdmin.post("/master/master-users").send({
      nome: "Financeiro Um",
      email,
      senha: "SenhaDeTeste123",
      role: "financeiro",
    });
    const financeiro = await loginMaster(email, "SenhaDeTeste123");

    const impersonate = await financeiro
      .post(`/master/tenants/${tenant.tenantId}/impersonate`)
      .send({ accessLevel: "read" });
    expect(impersonate.status).toBe(403);
  });

  it("acesso assistido leitura+escrita: ação é auditada como do MasterUser, não do usuário do tenant", async () => {
    const tenant = await signupTenant("impersonate-write");

    const impersonate = await superAdmin
      .post(`/master/tenants/${tenant.tenantId}/impersonate`)
      .send({ accessLevel: "read_write" });
    expect(impersonate.status).toBe(200);
    expect(impersonate.body.accessLevel).toBe("read_write");

    // /tenant-users/me não pode devolver 404 durante impersonação — o
    // `sub` do token é o MasterUser.id, não um TenantUser real.
    const me = await superAdmin.get("/tenant-users/me");
    expect(me.status).toBe(200);
    expect(me.body.nome).toContain("acesso assistido");

    const write = await superAdmin
      .patch(`/tenant-users/${tenant.userId}`)
      .send({ nome: "Editado via acesso assistido" });
    expect(write.status).toBe(200);

    const seedEmail = process.env.MASTER_SEED_EMAIL as string;
    const masterUser = await prisma.masterUser.findUniqueOrThrow({ where: { email: seedEmail } });

    const log = await prisma.auditLog.findFirst({
      where: { entity: "TenantUser", entityId: tenant.userId, action: "tenant_user.update" },
      orderBy: { timestamp: "desc" },
    });
    expect(log).not.toBeNull();
    expect(log?.actorType).toBe("master");
    expect(log?.actorId).toBe(masterUser.id);
    expect(log?.onBehalfOfTenantId).toBe(tenant.tenantId);
  });
});
