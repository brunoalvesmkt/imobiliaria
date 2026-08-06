import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Visibilidade de oportunidades por responsável: usuários sem a permissão
 * `crm:administer` só veem as próprias oportunidades (mais as sem
 * responsável, conforme `CrmVisibilityConfigService`); quem tem
 * `crm:administer` (papel "admin" padrão) continua vendo todas.
 */
describe("CRM — visibilidade de oportunidades por responsável", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let admin: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let userA: { agent: ReturnType<typeof request.agent>; id: string; email: string };
  let userB: { agent: ReturnType<typeof request.agent>; id: string; email: string };
  let funnelId: string;
  let stageId: string;
  let contactId: string;

  function randomCnpj(): string {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const calc = (nums: number[], weights: number[]) => {
      const sum = nums.reduce((acc, n, i) => acc + n * (weights[i] ?? 0), 0);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return [...base, d1, d2].join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@crm-visibility-test.local`;
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
      ...(await signupExtras(app)),
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    admin = await signupTenant("crmvis");
    await superAdmin.patch(`/master/tenants/${admin.tenantId}/modules`).send({ module: "crm", enabled: true });

    // Papel customizado sem crm:administer — só o essencial pra criar/ver/editar oportunidades.
    const role = await admin.agent.post("/roles").send({
      nome: `Vendedor ${randomUUID().slice(0, 6)}`,
      permissions: [
        { module: "crm", action: "view" },
        { module: "crm", action: "create" },
        { module: "crm", action: "edit" },
      ],
    });
    expect(role.status).toBe(201);

    async function createLoggedInUser(label: string) {
      const slug = label.toLowerCase().replace(/\s+/g, "-");
      const email = `${slug}-${randomUUID().slice(0, 8)}@crm-visibility-test.local`;
      const senha = "SenhaDeTeste123";
      const created = await admin.agent.post("/tenant-users").send({ nome: label, email, senha, roleId: role.body.id });
      expect(created.status).toBe(201);
      const agent = request.agent(app.getHttpServer());
      const login = await agent.post("/auth/tenant/login").send({ email, senha });
      expect(login.status).toBe(200);
      return { agent, id: created.body.id as string, email };
    }

    userA = await createLoggedInUser("Vendedor A");
    userB = await createLoggedInUser("Vendedor B");

    const contact = await admin.agent.post("/crm/contacts").send({ nome: "Cliente Visibilidade" });
    contactId = contact.body.id as string;
    const funnel = await admin.agent.post("/crm/funnels").send({ nome: `Funil Visibilidade ${randomUUID().slice(0, 6)}` });
    funnelId = funnel.body.id as string;
    const stage = await admin.agent.post(`/crm/funnels/${funnelId}/stages`).send({ nome: "Etapa 1", ordem: 0 });
    stageId = stage.body.id as string;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("usuário comum só vê as próprias oportunidades + as sem responsável; admin vê todas", async () => {
    const oppA = await admin.agent.post("/crm/opportunities").send({ contactId, funnelId, stageId, responsavelId: userA.id });
    expect(oppA.status).toBe(201);
    const oppB = await admin.agent.post("/crm/opportunities").send({ contactId, funnelId, stageId, responsavelId: userB.id });
    expect(oppB.status).toBe(201);

    const stageInfo = await prisma.funnelStage.findUniqueOrThrow({ where: { id: stageId } });
    const unassigned = await prisma.opportunity.create({
      data: { tenantId: admin.tenantId, contactId, funnelId, stageId, probabilidade: stageInfo.probabilidade, responsavelId: null },
    });

    // Usuário A: vê a própria + a sem responsável, não vê a do B.
    const listA = await userA.agent.get(`/crm/opportunities?funnelId=${funnelId}`);
    expect(listA.status).toBe(200);
    const idsA = listA.body.map((o: { id: string }) => o.id);
    expect(idsA).toEqual(expect.arrayContaining([oppA.body.id, unassigned.id]));
    expect(idsA).not.toContain(oppB.body.id);

    // Usuário A não consegue nem ver a oportunidade do B por id direto (404, não 403).
    const getOppBAsA = await userA.agent.get(`/crm/opportunities/${oppB.body.id}`);
    expect(getOppBAsA.status).toBe(404);

    // Nem editá-la.
    const editOppBAsA = await userA.agent.patch(`/crm/opportunities/${oppB.body.id}`).send({ observacoes: "tentando mexer" });
    expect(editOppBAsA.status).toBe(404);

    // Admin (crm:administer) vê as 3.
    const listAdmin = await admin.agent.get(`/crm/opportunities?funnelId=${funnelId}`);
    const idsAdmin = listAdmin.body.map((o: { id: string }) => o.id);
    expect(idsAdmin).toEqual(expect.arrayContaining([oppA.body.id, oppB.body.id, unassigned.id]));

    // Admin consegue editar a oportunidade do B normalmente.
    const editOppBAsAdmin = await admin.agent.patch(`/crm/opportunities/${oppB.body.id}`).send({ observacoes: "admin pode" });
    expect(editOppBAsAdmin.status).toBe(200);
  }, 20_000);

  it("modo 'especificos' restringe a visão das oportunidades sem responsável a uma lista", async () => {
    const configBefore = await admin.agent.get("/crm/visibility-config");
    expect(configBefore.body.semResponsavelModo).toBe("todos");

    const setConfig = await admin.agent
      .patch("/crm/visibility-config")
      .send({ semResponsavelModo: "especificos", semResponsavelUsuarioIds: [userA.id] });
    expect(setConfig.status).toBe(200);

    const stageInfo = await prisma.funnelStage.findUniqueOrThrow({ where: { id: stageId } });
    const unassigned2 = await prisma.opportunity.create({
      data: { tenantId: admin.tenantId, contactId, funnelId, stageId, probabilidade: stageInfo.probabilidade, responsavelId: null },
    });

    const listA = await userA.agent.get(`/crm/opportunities?funnelId=${funnelId}`);
    expect(listA.body.map((o: { id: string }) => o.id)).toContain(unassigned2.id);

    const listB = await userB.agent.get(`/crm/opportunities?funnelId=${funnelId}`);
    expect(listB.body.map((o: { id: string }) => o.id)).not.toContain(unassigned2.id);

    // Restaura o padrão para não vazar estado para outros testes que rodem no mesmo tenant.
    await admin.agent.patch("/crm/visibility-config").send({ semResponsavelModo: "todos" });
  }, 20_000);
});
