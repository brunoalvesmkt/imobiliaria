import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationDataTriggersScheduler } from "../automation/automation-data-triggers.scheduler";
import { DomainEventsService } from "../common/events/domain-events.service";

/**
 * Fase C (cobertura de gatilhos/condições/ações): categorização "posvenda"
 * dos eventos de billing, operadores de condição numéricos, 5 eventos de
 * domínio novos em métodos já existentes, os 2 gatilhos baseados em tempo
 * (categoria "Data", varredura via `AutomationDataTriggersScheduler`), a
 * ação `create_opportunity` e o método configurável de `send_webhook`.
 */
describe("Automação — Fase C (cobertura de gatilhos/condições/ações)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dataTriggersScheduler: AutomationDataTriggersScheduler;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let originalFetch: typeof fetch;

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
    const email = `${label}-${suffix}@automation-fase-c-test.local`;
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

  async function createFunnelWithStage(label: string) {
    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `${label} ${randomUUID().slice(0, 6)}` });
    const stage = await tenant.agent.post(`/crm/funnels/${funnel.body.id}/stages`).send({ nome: "Etapa 1", ordem: 0 });
    return { funnelId: funnel.body.id as string, stageId: stage.body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    dataTriggersScheduler = app.get(AutomationDataTriggersScheduler);
    originalFetch = global.fetch;

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("autoc");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
  });

  it("categorização: gatilhos de billing aparecem no catálogo com category 'posvenda'", async () => {
    const catalog = await tenant.agent.get("/automation/rules/catalog");
    expect(catalog.status).toBe(200);
    const billingTriggers = catalog.body.triggers.filter((t: { event: string }) =>
      ["invoice.paid", "invoice.overdue", "subscription.activated", "subscription.cancelled"].includes(t.event),
    );
    expect(billingTriggers).toHaveLength(4);
    for (const trig of billingTriggers) {
      expect(trig.category).toBe("posvenda");
    }
  });

  it("operador numérico: condição 'valor > X' só dispara quando o valor da oportunidade bate", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Valor alto ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "opportunity.won",
      condicoes: [{ campo: "valor", operador: "greater_than", valor: "1000" }],
      acoes: [{ tipo: "apply_tag", tag: "venda-grande" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Valor" });
    const { funnelId, stageId } = await createFunnelWithStage("Funil Valor");

    // Oportunidade abaixo do limiar — condição não bate, nenhuma execução deve ser criada.
    const oppBaixo = await tenant.agent.post("/crm/opportunities").send({ contactId: contact.body.id, funnelId, stageId, valor: 500 });
    await tenant.agent.patch(`/crm/opportunities/${oppBaixo.body.id}/close`).send({ resultado: "won" });

    // Oportunidade acima do limiar — condição bate.
    const oppAlto = await tenant.agent.post("/crm/opportunities").send({ contactId: contact.body.id, funnelId, stageId, valor: 5000 });
    await tenant.agent.patch(`/crm/opportunities/${oppAlto.body.id}/close`).send({ resultado: "won" });

    const execution = await waitFor(async () => {
      const e = await prisma.automationExecution.findFirst({ where: { automationId: automation.body.id }, orderBy: { createdAt: "asc" } });
      return e && e.status !== "pending" ? e : null;
    });
    expect(execution.status).toBe("success");

    const executions = await prisma.automationExecution.findMany({ where: { automationId: automation.body.id } });
    expect(executions).toHaveLength(1); // só a de valor alto — a de valor baixo nunca passou da condição

    const updatedContact = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(updatedContact.tags).toContain("venda-grande");
  }, 15_000);

  it("evento novo: marcar tarefa como concluída dispara 'crm_task.completed'", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Tarefa concluída ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.completed",
      acoes: [{ tipo: "apply_tag", tag: "tarefa-feita" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Tarefa" });
    const task = await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Ligar",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });
    await tenant.agent.patch(`/crm/tasks/${task.body.id}`).send({ status: "done" });

    const updatedContact = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("tarefa-feita") ? c : null;
    });
    expect(updatedContact.tags).toContain("tarefa-feita");
  }, 15_000);

  it("evento novo: unir contatos dispara 'contact.merged'", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Contato unido ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.merged",
      acoes: [{ tipo: "apply_tag", tag: "foi-mesclado" }],
    });
    expect(automation.status).toBe(201);

    const primary = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Principal" });
    const duplicate = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Duplicado" });
    const merge = await tenant.agent.post(`/crm/contacts/${primary.body.id}/merge`).send({ duplicateId: duplicate.body.id });
    expect(merge.status).toBe(201);

    const updatedPrimary = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: primary.body.id } });
      return c.tags.includes("foi-mesclado") ? c : null;
    });
    expect(updatedPrimary.tags).toContain("foi-mesclado");
  }, 15_000);

  it("gatilho de tempo: 'crm_task.due_soon' encontra tarefa vencendo dentro do parâmetro configurado", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Vence em breve ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.due_soon",
      gatilhoParametros: { horasAntecedencia: 24 },
      acoes: [{ tipo: "apply_tag", tag: "vence-logo" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Vence Logo" });
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Ligar antes do prazo",
      dataHora: new Date(Date.now() + 2 * 3_600_000).toISOString(), // vence em 2h — dentro das 24h configuradas
    });

    const result = await dataTriggersScheduler.runDueSoonCheck();
    expect(result.matched).toBeGreaterThanOrEqual(1);

    const updatedContact = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("vence-logo") ? c : null;
    });
    expect(updatedContact.tags).toContain("vence-logo");
  }, 15_000);

  it("gatilho de tempo: 'opportunity.stage_stagnant' encontra oportunidade parada além do parâmetro configurado", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Parada na etapa ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "opportunity.stage_stagnant",
      gatilhoParametros: { diasParado: 3 },
      acoes: [{ tipo: "apply_tag", tag: "parada" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Parado" });
    const { funnelId, stageId } = await createFunnelWithStage("Funil Estagnado");
    const opportunity = await tenant.agent.post("/crm/opportunities").send({ contactId: contact.body.id, funnelId, stageId });

    // Força a entrada na etapa para 5 dias atrás (além dos 3 dias configurados).
    await prisma.$executeRawUnsafe(
      `UPDATE "opportunity_stage_history" SET "enteredAt" = NOW() - INTERVAL '5 days' WHERE "opportunityId" = $1`,
      opportunity.body.id,
    );

    const result = await dataTriggersScheduler.runStageStagnantCheck();
    expect(result.matched).toBeGreaterThanOrEqual(1);

    const updatedContact = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("parada") ? c : null;
    });
    expect(updatedContact.tags).toContain("parada");
  }, 15_000);

  it("ação 'create_opportunity' cria uma nova oportunidade de verdade", async () => {
    const { stageId } = await createFunnelWithStage("Funil Nova Oportunidade");
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Cria oportunidade ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [{ tipo: "create_opportunity", stageId }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Lead Quente" });

    // Não há endpoint HTTP para "lead quente" (é calculado pelo Lead Score) — emite o evento
    // diretamente, mesmo padrão usado nos testes de Fase B para eventos sem gatilho HTTP direto.
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId: contact.body.id, data: { contactId: contact.body.id, score: 95 } });

    const opportunity = await waitFor(() =>
      prisma.opportunity.findFirst({ where: { tenantId: tenant.tenantId, contactId: contact.body.id, stageId } }),
    );
    expect(opportunity.stageId).toBe(stageId);
  }, 15_000);

  it("send_webhook com metodo 'GET' não envia corpo nem assinatura", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }) as unknown as typeof fetch;

    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Webhook GET ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.imported",
      acoes: [{ tipo: "send_webhook", url: "https://exemplo-externo.local/hook-get", metodo: "GET" }],
    });
    expect(automation.status).toBe(201);

    const csv = "nome\nCliente Importado Um\nCliente Importado Dois\n";
    const importResult = await tenant.agent.post("/crm/contacts/import").send({ format: "csv", content: csv });
    expect(importResult.status).toBe(201);

    await waitFor(async () => {
      const execution = await prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "success" } });
      return execution;
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://exemplo-externo.local/hook-get");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  }, 15_000);
});
