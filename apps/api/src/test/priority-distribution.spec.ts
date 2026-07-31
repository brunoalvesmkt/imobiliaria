import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 37 (ver DEVELOPMENT_PLAN.md): distribuição "priority" real —
 * débito registrado desde a Fase 5 ("priority ainda não é diferenciada de
 * least_volume, cai no mesmo algoritmo"). Agora restringe a distribuição
 * aos membros com a maior `TeamMember.prioridade` da equipe, desempatando
 * por menor volume entre eles.
 */
describe("Distribuição por prioridade (Fase 37)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

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
    const email = `${label}-${suffix}@priority-test.local`;
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
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
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

    tenant = await signupTenant("priority");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("sempre atribui ao membro de maior prioridade, ignorando o de menor prioridade mesmo com volume zero", async () => {
    const team = await tenant.agent.post("/atendimento/teams").send({ nome: `Equipe Prioridade ${randomUUID().slice(0, 6)}` });
    const teamId = team.body.id as string;

    const roles = await tenant.agent.get("/roles");
    const lowPriorityUser = await tenant.agent.post("/tenant-users").send({
      nome: "Atendente Baixa Prioridade",
      email: `baixa-${randomUUID().slice(0, 8)}@priority-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });
    const highPriorityUser = await tenant.agent.post("/tenant-users").send({
      nome: "Atendente Alta Prioridade",
      email: `alta-${randomUUID().slice(0, 8)}@priority-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });

    await tenant.agent.post(`/atendimento/teams/${teamId}/members`).send({ tenantUserId: lowPriorityUser.body.id, prioridade: 1 });
    await tenant.agent.post(`/atendimento/teams/${teamId}/members`).send({ tenantUserId: highPriorityUser.body.id, prioridade: 10 });

    const queue = await tenant.agent.post("/atendimento/queues").send({
      nome: `Fila Prioridade ${randomUUID().slice(0, 6)}`,
      teamId,
      distribuicao: "priority",
    });
    const queueId = queue.body.id as string;

    // Três conversas seguidas — todas devem ir para o de maior prioridade,
    // mesmo que o de baixa prioridade esteja com volume zero (diferente de
    // least_volume, que alternaria para equilibrar o volume).
    for (let i = 0; i < 3; i += 1) {
      const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
        whatsAppNumberId: numberId,
        fromNumero: `551195000${i}000`,
        conteudo: `Mensagem ${i}`,
      });
      const conversationId = incoming.body.conversationId as string;
      await tenant.agent.patch(`/atendimento/inbox/${conversationId}/queue`).send({ queueId });
      const assigned = await tenant.agent.post(`/atendimento/inbox/${conversationId}/auto-assign`);
      expect(assigned.body.responsavelId).toBe(highPriorityUser.body.id);
    }
  });

  it("atualizar a prioridade de um membro (PATCH) muda o resultado da próxima distribuição", async () => {
    const team = await tenant.agent.post("/atendimento/teams").send({ nome: `Equipe Prioridade Dinamica ${randomUUID().slice(0, 6)}` });
    const teamId = team.body.id as string;

    const roles = await tenant.agent.get("/roles");
    const userA = await tenant.agent.post("/tenant-users").send({
      nome: "Atendente A",
      email: `a-${randomUUID().slice(0, 8)}@priority-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });
    const userB = await tenant.agent.post("/tenant-users").send({
      nome: "Atendente B",
      email: `b-${randomUUID().slice(0, 8)}@priority-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });

    await tenant.agent.post(`/atendimento/teams/${teamId}/members`).send({ tenantUserId: userA.body.id, prioridade: 5 });
    await tenant.agent.post(`/atendimento/teams/${teamId}/members`).send({ tenantUserId: userB.body.id, prioridade: 1 });

    const queue = await tenant.agent.post("/atendimento/queues").send({
      nome: `Fila Prioridade Dinamica ${randomUUID().slice(0, 6)}`,
      teamId,
      distribuicao: "priority",
    });
    const queueId = queue.body.id as string;

    // Eleva a prioridade de B acima de A.
    const update = await tenant.agent.patch(`/atendimento/teams/${teamId}/members/${userB.body.id}`).send({ prioridade: 9 });
    expect(update.status).toBe(200);
    expect(update.body.prioridade).toBe(9);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955009999",
      conteudo: "Oi",
    });
    const conversationId = incoming.body.conversationId as string;
    await tenant.agent.patch(`/atendimento/inbox/${conversationId}/queue`).send({ queueId });
    const assigned = await tenant.agent.post(`/atendimento/inbox/${conversationId}/auto-assign`);
    expect(assigned.body.responsavelId).toBe(userB.body.id);
  });
});
