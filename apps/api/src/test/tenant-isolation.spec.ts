import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

interface TestTenant {
  agent: ReturnType<typeof request.agent>;
  tenantId: string;
  userId: string;
  adminRoleId: string;
  email: string;
}

/**
 * Testes de integração dos casos críticos #1 (isolamento multi-tenant) e #2
 * (autorização) definidos em ACCEPTANCE_CRITERIA.md. Rodam contra o
 * Postgres/Redis/MinIO reais de desenvolvimento (docker compose) — não
 * usam mocks, porque o que está sendo verificado é justamente o
 * comportamento real das camadas de guard/interceptor/Prisma wrapper.
 *
 * Todos os tenants de teste são criados uma única vez em `beforeAll` (em vez
 * de um signup por `it`) para não esbarrar no rate limit de `/auth/tenant/signup`
 * (5 requisições/60s — ver SECURITY.md §1) — que é, ele mesmo, uma proteção
 * de segurança real sendo exercitada, não um obstáculo a contornar.
 */
describe("Isolamento multi-tenant e autorização (Fase 1)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let leakcheckTenant: TestTenant;
  let nopermTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function signupTenant(label: string): Promise<TestTenant> {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@isolation-test.local`;
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
      throw new Error(`Signup falhou para "${label}": ${res.status} ${JSON.stringify(res.body)}`);
    }

    const me = await agent.get("/auth/tenant/me");
    const roles = await agent.get("/roles");
    const adminRoleId = (roles.body as Array<{ id: string }>)[0]?.id as string;

    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string, adminRoleId, email };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    leakcheckTenant = await signupTenant("leakcheck");
    nopermTenant = await signupTenant("noperm");
    tenantA = await signupTenant("tenanta");
    tenantB = await signupTenant("tenantb");
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("nunca retorna passwordHash nas respostas de tenant-users", async () => {
    const res = await leakcheckTenant.agent.get("/tenant-users");
    expect(res.status).toBe(200);
    for (const user of res.body) {
      expect(user).not.toHaveProperty("passwordHash");
    }
  });

  it("bloqueia acesso não autenticado a rota protegida (401)", async () => {
    const res = await request(app.getHttpServer()).get("/tenants/me");
    expect(res.status).toBe(401);
  });

  it("usuário sem Permission cadastrada recebe 403 ao tentar ação do módulo Configurações", async () => {
    // Remove todas as Permissions do papel admin recém-criado para simular
    // um papel sem acesso — reproduz o caso crítico #2 (autorização).
    await prisma.permission.deleteMany({ where: { role: { tenantId: nopermTenant.tenantId } } });

    const res = await nopermTenant.agent.get("/tenant-users");
    expect(res.status).toBe(403);
  });

  it("Empresa A não acessa/edita dados de Empresa B (isolamento multi-tenant)", async () => {
    // tenantB edita o próprio admin (deve funcionar - baseline).
    const selfEdit = await tenantB.agent
      .patch(`/tenant-users/${tenantB.userId}`)
      .send({ nome: "Editado por si mesmo" });
    expect(selfEdit.status).toBe(200);

    // tenantA tenta editar um usuário que pertence à tenantB, usando sua
    // própria sessão autenticada. O TenantScopedPrismaService injeta
    // automaticamente o tenantId de A no `where`, então o registro de B
    // nunca é encontrado — 404, nunca um vazamento ou edição cruzada.
    const crossTenantEdit = await tenantA.agent
      .patch(`/tenant-users/${tenantB.userId}`)
      .send({ nome: "Tentativa de invasão" });
    expect(crossTenantEdit.status).toBe(404);

    // Confirma no banco que o registro de B não foi alterado.
    const stillIntact = await prisma.tenantUser.findUniqueOrThrow({ where: { id: tenantB.userId } });
    expect(stillIntact.nome).toBe("Editado por si mesmo");

    // tenantA não vê o usuário de B na própria listagem.
    const listA = await tenantA.agent.get("/tenant-users");
    const idsVisibleToA = (listA.body as Array<{ id: string }>).map((u) => u.id);
    expect(idsVisibleToA).not.toContain(tenantB.userId);
  });

  it("tenant nunca é aceito a partir do input do cliente — só do token autenticado", async () => {
    // Mesmo se o cliente tentasse manipular o corpo da requisição com um
    // tenantId de outra empresa, o ValidationPipe global (whitelist +
    // forbidNonWhitelisted, ver main.ts) rejeita a requisição inteira por
    // conter uma propriedade não esperada pelo DTO — a mais estrita das
    // duas defesas possíveis (a outra seria descartar o campo em silêncio).
    const spoofAttempt = await tenantA.agent.post("/tenant-users").send({
      nome: "Spoof Attempt",
      email: `spoof-${randomUUID().slice(0, 8)}@isolation-test.local`,
      senha: "SenhaDeTeste123",
      roleId: tenantA.adminRoleId,
      tenantId: tenantB.tenantId, // propriedade não whitelisted — DTO não a declara
    });
    expect(spoofAttempt.status).toBe(400);

    // O mesmo payload, sem o campo forjado, é aceito normalmente — e o
    // registro criado pertence sempre ao tenant do token autenticado (A),
    // nunca a B: o tenantId nunca é lido do body em nenhum cenário.
    const legitimate = await tenantA.agent.post("/tenant-users").send({
      nome: "Usuário Legítimo",
      email: `legit-${randomUUID().slice(0, 8)}@isolation-test.local`,
      senha: "SenhaDeTeste123",
      roleId: tenantA.adminRoleId,
    });
    expect(legitimate.status).toBe(201);

    const created = await prisma.tenantUser.findUniqueOrThrow({ where: { id: legitimate.body.id } });
    expect(created.tenantId).toBe(tenantA.tenantId);
    expect(created.tenantId).not.toBe(tenantB.tenantId);
  });
});
