import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { TENANT_ACCESS_COOKIE } from "../auth/cookie.util";

/**
 * Testes de integração do módulo Atendimento (Fase 5): equipes, filas,
 * distribuição (round-robin/menor volume), ações sobre conversas (assumir,
 * transferir com resumo, devolver, encerrar/reabrir), horários e o evento
 * de tempo real via WebSocket.
 */
describe("Atendimento (Fase 5)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  function extractCookieValue(setCookieHeader: string[] | undefined, name: string): string | undefined {
    for (const cookie of setCookieHeader ?? []) {
      if (cookie.startsWith(`${name}=`)) {
        return cookie.split(";")[0]?.split("=")[1];
      }
    }
    return undefined;
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
    const email = `${label}-${suffix}@atendimento-test.local`;
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
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0);
    const address = app.getHttpServer().address();
    port = typeof address === "object" && address ? address.port : 0;
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) {
      throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    }
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("atd");
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

  it("bloqueia /atendimento/inbox quando o módulo não está ativo para outro tenant", async () => {
    const other = await signupTenant("atd-noaccess");
    const res = await other.agent.get("/atendimento/inbox");
    expect(res.status).toBe(403);
  });

  it("cria equipe, fila, distribui automaticamente (least_volume) e permite assumir/transferir/devolver/encerrar", async () => {
    const team = await tenant.agent.post("/atendimento/teams").send({ nome: "Equipe Comercial" });
    expect(team.status).toBe(201);

    const addMember = await tenant.agent
      .post(`/atendimento/teams/${team.body.id}/members`)
      .send({ tenantUserId: tenant.userId, papel: "agent" });
    expect(addMember.status).toBe(201);

    const queue = await tenant.agent.post("/atendimento/queues").send({
      nome: "Fila Geral",
      teamId: team.body.id,
      distribuicao: "least_volume",
    });
    expect(queue.status).toBe(201);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955554444",
      conteudo: "Preciso de ajuda",
    });
    const conversationId = incoming.body.conversationId as string;

    const assignQueue = await tenant.agent.patch(`/atendimento/inbox/${conversationId}/queue`).send({ queueId: queue.body.id });
    expect(assignQueue.status).toBe(200);
    expect(assignQueue.body.queueId).toBe(queue.body.id);

    const autoAssign = await tenant.agent.post(`/atendimento/inbox/${conversationId}/auto-assign`);
    expect(autoAssign.status).toBe(201);
    expect(autoAssign.body.responsavelId).toBe(tenant.userId);

    const returnToQueue = await tenant.agent.post(`/atendimento/inbox/${conversationId}/return-to-queue`);
    expect(returnToQueue.status).toBe(201);
    expect(returnToQueue.body.responsavelId).toBeNull();

    const assume = await tenant.agent.post(`/atendimento/inbox/${conversationId}/assume`);
    expect(assume.status).toBe(201);
    expect(assume.body.responsavelId).toBe(tenant.userId);

    // Cria um segundo atendente para transferir.
    const roles = await tenant.agent.get("/roles");
    const secondUser = await tenant.agent.post("/tenant-users").send({
      nome: "Segundo Atendente",
      email: `segundo-${randomUUID().slice(0, 8)}@atendimento-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });
    expect(secondUser.status).toBe(201);

    const transfer = await tenant.agent
      .post(`/atendimento/inbox/${conversationId}/transfer`)
      .send({ tenantUserId: secondUser.body.id });
    expect(transfer.status).toBe(201);
    expect(transfer.body.conversation.responsavelId).toBe(secondUser.body.id);
    expect(transfer.body.resumo).toContain("5511955554444");

    const close = await tenant.agent.post(`/atendimento/inbox/${conversationId}/close`);
    expect(close.status).toBe(201);
    expect(close.body.status).toBe("closed");

    const reopen = await tenant.agent.post(`/atendimento/inbox/${conversationId}/reopen`);
    expect(reopen.status).toBe(201);
    expect(reopen.body.status).toBe("open");

    // Todo o histórico de eventos foi registrado (assign, transfer, close, reopen...).
    const events = await prisma.conversationEvent.findMany({ where: { conversationId } });
    const eventTypes = events.map((e) => e.tipo);
    expect(eventTypes).toEqual(expect.arrayContaining(["assign", "transfer", "close", "reopen"]));
  });

  it("distribuição round_robin alterna entre os membros da equipe", async () => {
    const team = await tenant.agent.post("/atendimento/teams").send({ nome: `Equipe RR ${randomUUID().slice(0, 6)}` });
    await tenant.agent.post(`/atendimento/teams/${team.body.id}/members`).send({ tenantUserId: tenant.userId });

    const roles = await tenant.agent.get("/roles");
    const memberB = await tenant.agent.post("/tenant-users").send({
      nome: "Membro B",
      email: `membrob-${randomUUID().slice(0, 8)}@atendimento-test.local`,
      senha: "SenhaDeTeste123",
      roleId: roles.body[0].id,
    });
    await tenant.agent.post(`/atendimento/teams/${team.body.id}/members`).send({ tenantUserId: memberB.body.id });

    const queue = await tenant.agent.post("/atendimento/queues").send({
      nome: `Fila RR ${randomUUID().slice(0, 6)}`,
      teamId: team.body.id,
      distribuicao: "round_robin",
    });

    const assignedTo: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
        whatsAppNumberId: numberId,
        fromNumero: `551190000000${i}`,
        conteudo: `Mensagem ${i}`,
      });
      const conversationId = incoming.body.conversationId as string;
      await tenant.agent.patch(`/atendimento/inbox/${conversationId}/queue`).send({ queueId: queue.body.id });
      const assigned = await tenant.agent.post(`/atendimento/inbox/${conversationId}/auto-assign`);
      assignedTo.push(assigned.body.responsavelId as string);
    }

    // Alterna entre os dois membros — não atribui o mesmo duas vezes seguidas.
    expect(assignedTo[0]).not.toBe(assignedTo[1]);
    expect(assignedTo[1]).not.toBe(assignedTo[2]);
  });

  it("horários de atendimento: fila sem configuração fica sempre aberta; com horário restrito, respeita o expediente", async () => {
    const queue = await tenant.agent.post("/atendimento/queues").send({ nome: `Fila Horario ${randomUUID().slice(0, 6)}` });

    const openByDefault = await tenant.agent.get(`/atendimento/queues/${queue.body.id}/is-open`);
    expect(openByDefault.body.open).toBe(true);

    const now = new Date();
    const weekday = now.getDay();
    const addHours = await tenant.agent.post(`/atendimento/queues/${queue.body.id}/business-hours`).send({
      diaSemana: weekday,
      horaInicio: "00:00",
      horaFim: "23:59",
    });
    expect(addHours.status).toBe(201);

    const stillOpen = await tenant.agent.get(`/atendimento/queues/${queue.body.id}/is-open`);
    expect(stillOpen.body.open).toBe(true);

    const otherWeekday = (weekday + 3) % 7;
    const queue2 = await tenant.agent.post("/atendimento/queues").send({ nome: `Fila Fechada ${randomUUID().slice(0, 6)}` });
    await tenant.agent.post(`/atendimento/queues/${queue2.body.id}/business-hours`).send({
      diaSemana: otherWeekday,
      horaInicio: "00:00",
      horaFim: "23:59",
    });
    const closedToday = await tenant.agent.get(`/atendimento/queues/${queue2.body.id}/is-open`);
    expect(closedToday.body.open).toBe(false);
  });

  it("WebSocket: cliente autenticado recebe evento em tempo real de nova mensagem", async () => {
    const loginRes = await request(app.getHttpServer()).post("/auth/tenant/login").send({
      email: (await prisma.tenantUser.findUniqueOrThrow({ where: { id: tenant.userId } })).email,
      senha: "SenhaDeTeste123",
    });
    const token = extractCookieValue(loginRes.get("Set-Cookie"), TENANT_ACCESS_COOKIE);
    expect(token).toBeDefined();

    const socket: Socket = io(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
    });

    const eventPromise = new Promise<{ conversationId: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout esperando evento WebSocket")), 8000);
      socket.on("conversation:message", (payload: { conversationId: string }) => {
        clearTimeout(timeout);
        resolve(payload);
      });
      socket.on("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511911112222",
      conteudo: "Mensagem para o socket",
    });

    const received = await eventPromise;
    expect(received.conversationId).toBe(incoming.body.conversationId);

    socket.disconnect();
  }, 15_000);

  it("isolamento: outro tenant não vê equipes/filas/conversas deste tenant", async () => {
    const other = await signupTenant("atd-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "atendimento", enabled: true });

    const teams = await other.agent.get("/atendimento/teams");
    expect(teams.body).toHaveLength(0);

    const queues = await other.agent.get("/atendimento/queues");
    expect(queues.body).toHaveLength(0);
  });
});
