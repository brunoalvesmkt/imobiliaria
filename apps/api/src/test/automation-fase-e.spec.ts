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
 * Fase E (builder visual em etapas): confirma que o novo passo "wait" pausa a
 * execução de verdade (diferente de `schedule_followup`, que só agenda uma
 * mensagem futura sem interromper a sequência), retoma depois do delay com
 * revalidação (mesmo princípio de `sendFollowUp`, Fase B), e que o teste
 * simulado descreve a espera sem realmente pausar nada.
 */
describe("Automação — Fase E (builder visual: passo 'wait')", () => {
  let app: INestApplication;
  let prisma: PrismaService;
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
    const email = `${label}-${suffix}@automation-fase-e-test.local`;
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

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 150): Promise<T> {
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

    tenant = await signupTenant("autome");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("pausa e retoma: 'wait' interrompe a sequência de verdade e continua depois do delay", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Espera e retoma ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [
        { tipo: "apply_tag", tag: "antes-da-espera" },
        { tipo: "wait", delayMinutes: 0.02 }, // ~1.2s — mantém o teste rápido usando o mesmo mecanismo real de delay do BullMQ
        { tipo: "apply_tag", tag: "depois-da-espera" },
      ],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Espera" });
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId: contact.body.id, data: { contactId: contact.body.id, score: 92 } });

    const waiting = await waitFor(() =>
      prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "waiting" } }),
    );
    expect(waiting.resumeFromIndex).toBe(2);
    const passosNaPausa = waiting.acoesExecutadas as unknown as { tipo: string; status: string }[];
    expect(passosNaPausa).toHaveLength(2); // apply_tag + wait — a 3ª ação ainda não rodou
    expect(passosNaPausa[1]).toMatchObject({ tipo: "wait", status: "success" });

    const contactDuringWait = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(contactDuringWait.tags).toContain("antes-da-espera");
    expect(contactDuringWait.tags).not.toContain("depois-da-espera");

    const finished = await waitFor(
      () => prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "success" } }),
      15_000,
    );
    const passosFinais = finished.acoesExecutadas as unknown as { tipo: string; status: string }[];
    expect(passosFinais).toHaveLength(3);

    const contactAfter = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(contactAfter.tags).toContain("depois-da-espera");
  }, 20_000);

  it("cancelamento: automação pausada durante a espera cancela a retomada", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Espera cancelada ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [{ tipo: "apply_tag", tag: "rodou-antes-de-pausar" }, { tipo: "wait", delayMinutes: 0.02 }, { tipo: "apply_tag", tag: "nunca-deveria-rodar" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Cancelado" });
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", { tenantId: tenant.tenantId, contactId: contact.body.id, data: { contactId: contact.body.id, score: 88 } });

    await waitFor(() => prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "waiting" } }));

    const pause = await tenant.agent.patch(`/automation/rules/${automation.body.id}`).send({ status: "paused" });
    expect(pause.status).toBe(200);

    const cancelled = await waitFor(
      () => prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "cancelled" } }),
      15_000,
    );
    expect(cancelled.erro).toBeTruthy();

    const contactAfter = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(contactAfter.tags).toContain("rodou-antes-de-pausar");
    expect(contactAfter.tags).not.toContain("nunca-deveria-rodar");
  }, 20_000);

  it("simulado: passo 'wait' descreve a espera sem pausar de verdade nem criar execução", async () => {
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Simulação com espera ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "contact.lead_hot",
      acoes: [{ tipo: "apply_tag", tag: "primeiro" }, { tipo: "wait", delayMinutes: 60 }, { tipo: "apply_tag", tag: "segundo" }],
    });
    expect(automation.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Simulado Espera" });
    const before = await prisma.automationExecution.count({ where: { automationId: automation.body.id } });

    const simulate = await tenant.agent.post(`/automation/rules/${automation.body.id}/simulate`).send({ contactId: contact.body.id });
    expect(simulate.status).toBe(201);
    expect(simulate.body.passos).toHaveLength(3); // termina síncrono na mesma resposta HTTP, sem travar nos 60min do "wait"
    expect(simulate.body.passos[1]).toMatchObject({ tipo: "wait", status: "success" });
    expect(simulate.body.passos[1].result).toMatchObject({ simulado: true, esperariaMinutos: 60 });

    const after = await prisma.automationExecution.count({ where: { automationId: automation.body.id } });
    expect(after).toBe(before);
  }, 15_000);
});
