import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import type { FlowDefinition } from "../chatbot/flow-definition.types";

/**
 * Fase 41 (ver DEVELOPMENT_PLAN.md): Lead Score (Fase 35) e Análise de
 * Atendimento (Fase 40) passam a gerar notificação in-app (Fase 34) —
 * "lead quente" quando o score cruza para "quente", "análise concluída"
 * quando uma nova avaliação é gerada.
 */
describe("Notificações — Lead Score e Análise (Fase 41)", () => {
  let app: INestApplication;
  let originalFetch: typeof fetch;
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
    const email = `${label}-${suffix}@notif41-test.local`;
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

  function mockClaudeAnalysis(json: Record<string, unknown>) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }] }),
      text: async () => JSON.stringify({ content: [{ type: "text", text: JSON.stringify(json) }] }),
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("notif41");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-ant-teste-notif41" });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
  }, 30_000);

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lead cruzando para 'quente' gera notificação, e não repete em pontuações seguintes que continuam quentes", async () => {
    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask", type: "question", data: { texto: "Orçamento?", variavel: "orcamento", validacao: "texto", pontuacao: 80 } },
        { id: "ask2", type: "question", data: { texto: "Mais alguma coisa?", variavel: "extra", validacao: "texto", pontuacao: 5 } },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask" },
        { id: "e2", source: "ask", target: "ask2" },
        { id: "e3", source: "ask2", target: "end" },
      ],
    };
    const flowCreate = await tenant.agent.post("/chatbot/flows").send({ nome: `Flow Lead Quente ${randomUUID().slice(0, 6)}` });
    const flowId = flowCreate.body.id as string;
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definition);
    await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const contatoNumero = "5511977776666";
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    // +80 -> cruza para "quente" (>=70).
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "R$ 10000",
    });

    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string }) => n.tipo === "contact.lead_hot") ? true : null;
    });

    // +5 -> continua quente (85), não deve gerar uma segunda notificação.
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Não",
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const list = await tenant.agent.get("/notifications");
    const hotNotifications = list.body.filter((n: { tipo: string }) => n.tipo === "contact.lead_hot");
    expect(hotNotifications).toHaveLength(1);
  }, 20_000);

  it("análise de atendimento concluída gera notificação com a nota", async () => {
    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511977775555",
      conteudo: "Quero saber o preço",
    });
    const conversationId = incoming.body.conversationId as string;

    mockClaudeAnalysis({
      notaGeral: 7.2,
      classificacao: "bom",
      criteriosAvaliados: [],
      pontosPositivos: [],
      pontosMelhoria: [],
      oportunidadesPerdidas: [],
      momentosCriticos: [],
      sugestoes: [],
      resumoExecutivo: "Atendimento adequado.",
    });

    const analyze = await tenant.agent.post(`/atendimento/inbox/${conversationId}/analysis`);
    expect(analyze.status).toBe(201);

    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string; corpo: string }) => n.tipo === "conversation.analysis_completed" && n.corpo.includes("7.2"))
        ? true
        : null;
    });
  });
});
