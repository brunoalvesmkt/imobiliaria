import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID, createHmac } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Fase 28 (ver DEVELOPMENT_PLAN.md): novos gatilhos de domínio
 * ("contact.created", "conversation.closed", "whatsapp_number.connected"),
 * disparo manual de teste (sem esperar o evento real) e assinatura HMAC na
 * ação "send_webhook". Arquivo próprio (não dentro de `automation.spec.ts`,
 * que já tem 4 cadastros de tenant) para não se aproximar do limite de
 * throttle de `POST /auth/tenant/signup` (5/60s por instância da app),
 * mesmo ajuste já feito na Fase 14.
 */
describe("Automação — Fase 28", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let originalFetch: typeof fetch;

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
    const email = `${label}-${suffix}@automation28-test.local`;
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

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("auto28");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await app.close();
  });

  it("novo gatilho 'contact.created' dispara a automação quando um contato é criado", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Boas-vindas ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.created",
      acoes: [{ tipo: "apply_tag", tag: "novo-contato" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Fase 28" });
    expect(contact.status).toBe(201);

    const updated = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("novo-contato") ? c : null;
    });
    expect(updated.tags).toContain("novo-contato");
  }, 15_000);

  it("disparo manual de teste cria e processa uma execução sem esperar o evento real, ignorando condições", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Automação Teste Manual ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.created",
      condicoes: [{ campo: "origem", operador: "equals", valor: "nunca-vai-bater" }],
      acoes: [{ tipo: "apply_tag", tag: "disparado-manualmente" }],
    });
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Teste Manual" });

    const test = await tenant.agent.post(`/automation/rules/${automation.body.id}/test`).send({ contactId: contact.body.id });
    expect(test.status).toBe(201);
    expect(test.body.automationExecutionId).toBeDefined();

    const updated = await waitFor(async () => {
      const c = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
      return c.tags.includes("disparado-manualmente") ? c : null;
    });
    expect(updated.tags).toContain("disparado-manualmente");

    const execution = await prisma.automationExecution.findUniqueOrThrow({ where: { id: test.body.automationExecutionId } });
    expect(execution.status).toBe("success");
    expect(execution.gatilhoDisparado).toContain("teste manual");
  }, 15_000);

  it("send_webhook assina o corpo com HMAC-SHA256 usando o segredo da automação", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }) as unknown as typeof fetch;

    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Webhook Assinado ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.created",
      acoes: [{ tipo: "send_webhook", url: "https://exemplo-externo.local/hook" }],
    });
    expect(automation.status).toBe(201);

    const record = await prisma.automation.findUniqueOrThrow({ where: { id: automation.body.id } });
    expect(record.webhookSecret).toMatch(/^whsec_/);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Webhook" });

    await waitFor(async () => {
      const execution = await prisma.automationExecution.findFirst({
        where: { automationId: automation.body.id, status: "success" },
      });
      return execution;
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://exemplo-externo.local/hook");
    const signatureHeader = init.headers["X-Automation-Signature"] as string;
    expect(signatureHeader).toMatch(/^sha256=/);

    const expectedSignature = "sha256=" + createHmac("sha256", record.webhookSecret!).update(init.body).digest("hex");
    expect(signatureHeader).toBe(expectedSignature);
  }, 15_000);
});
