import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { DomainEventsService } from "../common/events/domain-events.service";

/**
 * Fase D (modelos prontos + teste simulado + histórico detalhado): confirma
 * que `acoesExecutadas` passa a ser gravado também quando uma execução real
 * falha (antes só gravava no sucesso), que `POST /automation/rules/:id/simulate`
 * roda sem nenhum efeito real e sem criar `AutomationExecution`, e que a
 * biblioteca de modelos prontos filtra pelos módulos ativos e ativa uma
 * automação de verdade.
 */
describe("Automação — Fase D (modelos, simulado, histórico)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    const email = `${label}-${suffix}@automation-fase-d-test.local`;
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
    originalFetch = global.fetch;

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("automd");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
  });

  it("histórico: execução com 2 ações onde a 2ª falha grava as duas em acoesExecutadas", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Falha simulada de rede")) as unknown as typeof fetch;

    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Histórico com falha ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [
        { tipo: "apply_tag", tag: "processado-parcial" },
        { tipo: "send_webhook", url: "https://exemplo-externo.local/hook-falha", metodo: "POST" },
      ],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Histórico Falho" });

    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId: contact.body.id, data: { contactId: contact.body.id, score: 90 } });

    const execution = await waitFor(async () => {
      const e = await prisma.automationExecution.findFirst({
        where: { automationId: automation.body.id, status: { in: ["failed", "dead_letter"] } },
        orderBy: { createdAt: "desc" },
      });
      return e;
    });

    const passos = execution.acoesExecutadas as unknown as { tipo: string; status: string; result?: unknown; erro?: string }[];
    expect(passos).toHaveLength(2);
    expect(passos[0]).toMatchObject({ tipo: "apply_tag", status: "success" });
    expect(passos[1]).toMatchObject({ tipo: "send_webhook", status: "error" });
    expect(passos[1]?.erro).toContain("Falha simulada de rede");

    const updatedContact = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(updatedContact.tags).toContain("processado-parcial"); // 1ª ação rodou de verdade antes da falha da 2ª
  }, 15_000);

  it("simulado: POST /automation/rules/:id/simulate não aplica efeitos reais nem cria execução", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Simulação apply_tag ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [{ tipo: "apply_tag", tag: "nunca-deveria-aparecer" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Simulado" });

    const before = await prisma.automationExecution.count({ where: { automationId: automation.body.id } });

    const simulate = await tenant.agent.post(`/automation/rules/${automation.body.id}/simulate`).send({ contactId: contact.body.id });
    expect(simulate.status).toBe(201);
    expect(simulate.body.passos).toHaveLength(1);
    expect(simulate.body.passos[0]).toMatchObject({ tipo: "apply_tag", status: "success" });
    expect(simulate.body.passos[0].result).toMatchObject({ simulado: true });

    const contactAfter = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(contactAfter.tags).not.toContain("nunca-deveria-aparecer");

    const after = await prisma.automationExecution.count({ where: { automationId: automation.body.id } });
    expect(after).toBe(before); // nenhuma AutomationExecution foi criada pelo teste simulado
  }, 15_000);

  it("modelos: GET /templates filtra por módulo ativo e POST /activate cria automação real", async () => {
    const templates = await tenant.agent.get("/automation/rules/templates");
    expect(templates.status).toBe(200);

    const byId = new Map<string, { available: boolean; gatilhoTipo: string }>(
      templates.body.map((t: { id: string; available: boolean; gatilhoTipo: string }) => [t.id, t]),
    );

    // "welcome_message" depende do gatilho conversation.created, que exige o módulo "atendimento" —
    // não ativado para este tenant (só crm + automacao) — então deve aparecer como indisponível.
    expect(byId.get("welcome_message")?.available).toBe(false);
    // "hot_lead_followup" depende só de "crm", que está ativo.
    expect(byId.get("hot_lead_followup")?.available).toBe(true);
    // "overdue_invoice_task" não depende de nenhum módulo específico.
    expect(byId.get("overdue_invoice_task")?.available).toBe(true);

    const activate = await tenant.agent.post("/automation/rules/templates/hot_lead_followup/activate").send({ nome: "Cobrar lead quente (modelo)" });
    expect(activate.status).toBe(201);
    expect(activate.body.gatilhoTipo).toBe("contact.lead_hot");
    expect(activate.body.acoes).toHaveLength(1);
    expect(activate.body.acoes[0]).toMatchObject({ tipo: "create_task" });

    const created = await tenant.agent.get(`/automation/rules/${activate.body.id}`);
    expect(created.status).toBe(200);
    expect(created.body.nome).toBe("Cobrar lead quente (modelo)");
    expect(created.body.gatilhoTipo).toBe("contact.lead_hot");
  }, 15_000);
});
