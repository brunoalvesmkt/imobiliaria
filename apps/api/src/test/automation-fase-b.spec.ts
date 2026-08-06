import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { DomainEventsService } from "../common/events/domain-events.service";
import { AutomationProducer } from "../automation/automation.producer";
import { runWithAutomationChain } from "../automation/automation-chain-context";
import { MAX_AUTOMATION_CHAIN_DEPTH } from "../automation/automation-definition.types";

/**
 * Testes da Fase B (motor mais robusto) do módulo Automação: controle de
 * frequência (cooldown), idempotência de execução travada em "running",
 * revalidação de condições/status na espera de um follow-up agendado, e
 * bloqueio por profundidade de corrente (prevenção de loop entre
 * automações). Ver plano em C:\Users\bruno\.claude\plans — motor de
 * execução (fila/retry/backoff) não muda, só a camada de definição/catálogo.
 */
describe("Automação (Fase B — motor mais robusto)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let domainEvents: DomainEventsService;
  let automationProducer: AutomationProducer;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

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
    const email = `${label}-${suffix}@automation-fase-b-test.local`;
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

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 200): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error("Timeout esperando condição.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    domainEvents = app.get(DomainEventsService);
    automationProducer = app.get(AutomationProducer);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("autob");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("cooldown: segunda ocorrência do mesmo gatilho para o mesmo contato fica 'throttled' dentro da janela", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Cooldown ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      cooldownMinutos: 60,
      acoes: [{ tipo: "apply_tag", tag: "quente" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Lead Cooldown" });
    const contactId = contact.body.id as string;

    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId, data: { contactId, score: 90 } });
    const first = await waitFor(async () => {
      const e = await prisma.automationExecution.findFirst({
        where: { automationId: automation.body.id, contactId },
        orderBy: { createdAt: "asc" },
      });
      return e && e.status !== "pending" ? e : null;
    });
    expect(first.status).toBe("success");

    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId, data: { contactId, score: 95 } });
    const throttled = await waitFor(async () => {
      const executions = await prisma.automationExecution.findMany({
        where: { automationId: automation.body.id, contactId },
        orderBy: { createdAt: "asc" },
      });
      return executions.length >= 2 ? executions[1] : null;
    });
    expect(throttled?.status).toBe("throttled");

    const updated = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(updated.tags).toEqual(["quente"]); // a 2ª tentativa não rodou de novo
  }, 15_000);

  it("idempotência: execução travada em 'running' recente não é reprocessada, mas uma antiga (órfã) é", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Running travada ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot", // não dispara sozinho — evita colidir com o contact.created emitido por POST /crm/contacts
      acoes: [{ tipo: "apply_tag", tag: "processado" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Running" });
    const contactId = contact.body.id as string;

    const execution = await prisma.automationExecution.create({
      data: {
        tenantId: tenant.tenantId,
        automationId: automation.body.id,
        contactId,
        gatilhoDisparado: "contact.lead_hot",
        status: "running",
        tentativas: 1,
      },
    });

    // "running" recente — reenfileirar deve ser no-op (nenhuma tag aplicada).
    await automationProducer.enqueueExecution(execution.id);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const afterRecent = await prisma.automationExecution.findUniqueOrThrow({ where: { id: execution.id } });
    expect(afterRecent.status).toBe("running");
    expect(afterRecent.tentativas).toBe(1);
    const contactAfterRecent = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(contactAfterRecent.tags).toEqual([]);

    // Simula worker derrubado: força updatedAt para além do limite de "running travada".
    await prisma.$executeRawUnsafe(
      `UPDATE "automation_executions" SET "updatedAt" = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      execution.id,
    );

    await automationProducer.enqueueExecution(execution.id);
    const reprocessed = await waitFor(async () => {
      const e = await prisma.automationExecution.findUniqueOrThrow({ where: { id: execution.id } });
      return e.status === "success" ? e : null;
    });
    expect(reprocessed.tentativas).toBe(2);
    const contactAfterStale = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(contactAfterStale.tags).toEqual(["processado"]);
  }, 15_000);

  it("espera com revalidação: follow-up é cancelado se a automação for pausada antes de disparar", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Follow-up revalidado ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "conversation.created",
      acoes: [{ tipo: "schedule_followup", delayMinutes: 0.05, texto: "Ainda por aí?" }], // ~3s
    });
    expect(automation.status).toBe(201);

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55118${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({});

    const contatoNumero = "5511944445555";
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    const conversationId = first.body.conversationId as string;

    const followUp = await waitFor(() =>
      prisma.followUpSchedule.findFirst({ where: { automationId: automation.body.id, conversationId } }),
    );
    expect(followUp.status).toBe("scheduled");
    expect(followUp.dadosGatilho).toBeTruthy();

    // Pausa a automação antes do follow-up disparar.
    await tenant.agent.patch(`/automation/rules/${automation.body.id}`).send({ status: "paused" });

    const cancelled = await waitFor(async () => {
      const f = await prisma.followUpSchedule.findUniqueOrThrow({ where: { id: followUp.id } });
      return f.status === "cancelled" ? f : null;
    }, 6000);
    expect(cancelled.canceladoPorEvento).toBe("automation_inactive");

    const conversation = await tenant.agent.get(`/whatsapp/conversations/${conversationId}`);
    const followUpMessageSent = conversation.body.messages.some((m: { conteudo: string | null }) =>
      m.conteudo?.includes("Ainda por aí"),
    );
    expect(followUpMessageSent).toBe(false);
  }, 15_000);

  it("prevenção de loop: corrente além da profundidade máxima é bloqueada como 'loop_blocked' e não enfileirada", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Loop ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot", // só dispara pelo emit manual abaixo — não colide com o contact.created de POST /crm/contacts
      acoes: [{ tipo: "apply_tag", tag: "nao_deveria_rodar" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Loop" });
    const contactId = contact.body.id as string;

    // Simula que este disparo já vem de dentro de uma corrente na profundidade máxima —
    // mesmo mecanismo usado por AutomationProcessor.runExecution ao rodar um job.
    await runWithAutomationChain({ executionId: "fake-chain-root", depth: MAX_AUTOMATION_CHAIN_DEPTH }, async () => {
      domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId, data: { contactId, score: 99 } });
    });

    const blocked = await waitFor(async () => {
      const e = await prisma.automationExecution.findFirst({
        where: { automationId: automation.body.id, contactId },
        orderBy: { createdAt: "desc" },
      });
      return e && e.status === "loop_blocked" ? e : null;
    });
    expect(blocked.chainDepth).toBe(MAX_AUTOMATION_CHAIN_DEPTH + 1);
    expect(blocked.erro).toContain("profundidade máxima");

    const updated = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(updated.tags).toEqual([]); // ação nunca rodou — nem chegou a ser enfileirada
  }, 15_000);
});
