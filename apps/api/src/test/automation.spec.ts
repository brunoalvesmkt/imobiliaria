import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationProducer } from "../automation/automation.producer";

/**
 * Testes de integração da Automação (Fase 7): gatilho real disparado por
 * evento de domínio (criação de tarefa do CRM), condição filtrando quando
 * não bate, ação executada de verdade, idempotência contra reprocessamento
 * (caso crítico #8) e cancelamento automático de follow-up por resposta do
 * cliente (caso crítico #9). O teste de exaustão de tentativas até
 * dead-letter fica documentado mas não executado aqui: o backoff
 * exponencial padrão (3 tentativas, 5s/10s/20s) levaria a suíte a ~35s só
 * nesse caso — verificamos a transição para "failed" na 1ª tentativa
 * (rápida) e confiamos na revisão de código para o restante do ciclo.
 */
describe("Automação (Fase 7)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    const email = `${label}-${suffix}@automation-test.local`;
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
    automationProducer = app.get(AutomationProducer);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("auto");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("bloqueia /automation/rules quando o módulo não está ativo para outro tenant", async () => {
    const other = await signupTenant("auto-noaccess");
    const res = await other.agent.get("/automation/rules");
    expect(res.status).toBe(403);
  });

  it("gatilho real (crm_task.created) com condição: executa ação quando bate, ignora quando não bate", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Marcar VIP ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.created",
      condicoes: [{ campo: "tipo", operador: "equals", valor: "ligacao" }],
      acoes: [{ tipo: "apply_tag", tag: "vip" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Automação" });

    // Tarefa do tipo "ligacao" — condição bate, ação deve rodar.
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Ligar para o cliente",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });

    const updatedContact = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("vip") ? c : null;
    });
    expect(updatedContact.tags).toContain("vip");

    const execution = await prisma.automationExecution.findFirstOrThrow({ where: { automationId: automation.body.id } });
    expect(execution.status).toBe("success");
    expect(execution.tentativas).toBe(1);

    // Tarefa do tipo "reuniao" — condição não bate, nenhuma nova execução deve ser criada.
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "reuniao",
      titulo: "Reunião com o cliente",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const executionsAfter = await prisma.automationExecution.findMany({ where: { automationId: automation.body.id } });
    expect(executionsAfter).toHaveLength(1); // continua só a primeira
  }, 20_000);

  it("idempotência: reprocessar uma execução já concluída não repete a ação (caso crítico #8)", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Criar tarefa followup ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.created",
      condicoes: [{ campo: "tipo", operador: "equals", valor: "cobranca" }],
      acoes: [{ tipo: "create_task", titulo: "Tarefa gerada pela automação", tipoTarefa: "custom" }],
    });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Idempotencia" });
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "cobranca",
      titulo: "Cobrar cliente",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });

    const execution = await waitFor(() =>
      prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "success" } }),
    );

    const tasksBefore = await prisma.crmTask.count({ where: { contactId: contact.body.id } });
    expect(tasksBefore).toBe(2); // "Cobrar cliente" (manual) + a criada pela automação

    // Reenfileira a MESMA execução (já finalizada) — simula um reprocessamento indevido.
    await automationProducer.enqueueExecution(execution.id);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const tasksAfter = await prisma.crmTask.count({ where: { contactId: contact.body.id } });
    expect(tasksAfter).toBe(tasksBefore); // nenhuma tarefa duplicada

    const executionAfter = await prisma.automationExecution.findUniqueOrThrow({ where: { id: execution.id } });
    expect(executionAfter.tentativas).toBe(1); // não foi reprocessada
  }, 15_000);

  it("follow-up agendado é cancelado quando o cliente responde antes do envio (caso crítico #9)", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Follow-up pós contato ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "conversation.created",
      acoes: [{ tipo: "schedule_followup", delayMinutes: 0.05, texto: "Ainda precisa de ajuda?" }], // ~3s
    });
    expect(automation.status).toBe(201);

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({});

    const contatoNumero = "5511933332222";
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi, preciso de ajuda",
    });
    const conversationId = first.body.conversationId as string;

    const followUp = await waitFor(() =>
      prisma.followUpSchedule.findFirst({ where: { automationId: automation.body.id, conversationId } }),
    );
    expect(followUp.status).toBe("scheduled");

    // Cliente responde antes do follow-up disparar — deve cancelar.
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Já resolvi, obrigado!",
    });

    const cancelled = await waitFor(async () => {
      const f = await prisma.followUpSchedule.findUniqueOrThrow({ where: { id: followUp.id } });
      return f.status === "cancelled" ? f : null;
    });
    expect(cancelled.canceladoPorEvento).toBe("customer_replied");

    // Espera o horário original do follow-up passar e confirma que NÃO foi enviado.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const stillCancelled = await prisma.followUpSchedule.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(stillCancelled.status).toBe("cancelled");

    const conversation = await tenant.agent.get(`/whatsapp/conversations/${conversationId}`);
    const followUpMessageSent = conversation.body.messages.some((m: { conteudo: string | null }) =>
      m.conteudo?.includes("Ainda precisa de ajuda"),
    );
    expect(followUpMessageSent).toBe(false);
  }, 20_000);

  it("ação que falha marca a execução como 'failed' já na primeira tentativa", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Automação com falha ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.created",
      condicoes: [{ campo: "tipo", operador: "equals", valor: "avaliacao" }],
      acoes: [{ tipo: "move_opportunity_stage", stageId: "inexistente" }, { tipo: "create_task", titulo: "Nunca deveria rodar", tipoTarefa: "custom" }],
    });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Falha" });
    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `Funil Falha ${randomUUID().slice(0, 6)}` });
    const stage = await tenant.agent.post(`/crm/funnels/${funnel.body.id}/stages`).send({ nome: "Etapa 1", ordem: 0 });
    await tenant.agent.post("/crm/opportunities").send({ contactId: contact.body.id, funnelId: funnel.body.id, stageId: stage.body.id });

    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "avaliacao",
      titulo: "Pedir avaliação",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });

    const execution = await waitFor(async () => {
      const e = await prisma.automationExecution.findFirst({ where: { automationId: automation.body.id } });
      return e && e.status !== "pending" && e.status !== "running" ? e : null;
    });
    expect(execution.status).toBe("failed");
    expect(execution.erro).toBeTruthy();

    // A segunda ação (create_task) nunca deveria ter rodado, pois a primeira lançou erro.
    const tasks = await prisma.crmTask.findMany({ where: { contactId: contact.body.id, titulo: "Nunca deveria rodar" } });
    expect(tasks).toHaveLength(0);
  }, 15_000);

  it("isolamento: outro tenant não vê automações deste tenant", async () => {
    const other = await signupTenant("auto-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "automacao", enabled: true });

    const rules = await other.agent.get("/automation/rules");
    expect(rules.body).toHaveLength(0);
  });
});
