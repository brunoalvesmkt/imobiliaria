import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { CrmTasksOverdueScheduler } from "../crm/tasks/crm-tasks-overdue.scheduler";

/**
 * Fase 34 (ver DEVELOPMENT_PLAN.md): central de notificações in-app —
 * gap real do prompt mestre §6 nunca coberto nas fases anteriores. Cobre o
 * caminho de broadcast ("nova conversa"), o caminho dirigido a um usuário
 * específico ("nova transferência"), marcação de lida, e isolamento entre
 * tenants.
 */
describe("Notificações in-app (Fase 34)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 200): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error("Timeout aguardando condição.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@notifications-test.local`;
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

    tenant = await signupTenant("notif");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });

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

  it("uma nova conversa gera notificação de broadcast (recipientUserId nulo), visível para qualquer usuário do tenant", async () => {
    const before = await tenant.agent.get("/notifications/unread-count");
    const beforeCount = before.body.count as number;

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955550001",
      conteudo: "Olá",
    });
    expect(incoming.status).toBe(201);

    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string }) => n.tipo === "conversation.created") ? true : null;
    });

    const after = await tenant.agent.get("/notifications/unread-count");
    expect(after.body.count).toBeGreaterThan(beforeCount);

    const list = await tenant.agent.get("/notifications");
    const notification = list.body.find((n: { tipo: string }) => n.tipo === "conversation.created");
    expect(notification.recipientUserId).toBeNull();
    expect(notification.readAt).toBeNull();
  });

  it("transferir uma conversa notifica só o novo responsável — outro usuário do mesmo tenant não a vê", async () => {
    const roles = await tenant.agent.get("/roles");
    const secondUserEmail = `atendente-${randomUUID().slice(0, 8)}@notifications-test.local`;
    const secondUserSenha = "SenhaDeTeste123";
    const secondUser = await tenant.agent.post("/tenant-users").send({
      nome: "Atendente Notificações",
      email: secondUserEmail,
      senha: secondUserSenha,
      roleId: roles.body[0].id,
    });
    expect(secondUser.status).toBe(201);
    const secondUserId = secondUser.body.id as string;

    const secondAgent = request.agent(app.getHttpServer());
    const secondLogin = await secondAgent.post("/auth/tenant/login").send({ email: secondUserEmail, senha: secondUserSenha });
    expect(secondLogin.status).toBe(200);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955550002",
      conteudo: "Preciso de ajuda",
    });
    const conversationId = incoming.body.conversationId as string;

    const transfer = await tenant.agent.post(`/atendimento/inbox/${conversationId}/transfer`).send({ tenantUserId: secondUserId });
    expect(transfer.status).toBe(201);

    // O responsável direto (secondAgent) vê a notificação dirigida a ele...
    await waitFor(async () => {
      const list = await secondAgent.get("/notifications");
      return list.body.find((n: { tipo: string; recipientUserId: string }) => n.tipo === "conversation.transferred" && n.recipientUserId === secondUserId)
        ? true
        : null;
    });

    // ...mas o dono da empresa (que não é o destinatário) não a vê na própria lista.
    const ownerList = await tenant.agent.get("/notifications");
    const visibleToOwner = ownerList.body.filter(
      (n: { tipo: string; recipientUserId: string | null }) => n.tipo === "conversation.transferred" && n.recipientUserId === secondUserId,
    );
    expect(visibleToOwner).toEqual([]);
  }, 15_000);

  it("marcar como lida funciona, e todo o histórico do tenant fica invisível para outro tenant", async () => {
    const list = await tenant.agent.get("/notifications");
    const target = list.body[0];
    expect(target).toBeDefined();

    const markRead = await tenant.agent.patch(`/notifications/${target.id}/read`);
    expect(markRead.status).toBe(200);
    expect(markRead.body.readAt).not.toBeNull();

    const markAll = await tenant.agent.patch("/notifications/read-all");
    expect(markAll.status).toBe(200);
    const unreadAfter = await tenant.agent.get("/notifications/unread-count");
    expect(unreadAfter.body.count).toBe(0);

    const otherTenant = await signupTenant("notif-other");
    const otherList = await otherTenant.agent.get("/notifications");
    expect(otherList.body).toEqual([]);
  });

  it("desconectar um número gera notificação de broadcast, e retorno atrasado (verificação manual) notifica o responsável", async () => {
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/disconnect`);
    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string }) => n.tipo === "whatsapp_number.disconnected") ? true : null;
    });

    // Reconecta para não afetar outros specs que rodam em paralelo contra o mesmo tenant.
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Retorno" });
    const overdueTask = await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "retorno",
      titulo: "Ligar de volta",
      dataHora: new Date(Date.now() - 60_000).toISOString(),
      responsavelId: tenant.userId,
    });
    expect(overdueTask.status).toBe(201);

    const scheduler = app.get(CrmTasksOverdueScheduler);
    const result = await scheduler.runOverdueCheck();
    expect(result.overdue).toBeGreaterThanOrEqual(1);

    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string; recipientUserId: string | null }) => n.tipo === "crm_task.overdue" && n.recipientUserId === tenant.userId)
        ? true
        : null;
    });

    const updatedTask = await tenant.agent.get(`/crm/tasks/${overdueTask.body.id}`);
    expect(updatedTask.body.status).toBe("overdue");
  }, 15_000);
});
