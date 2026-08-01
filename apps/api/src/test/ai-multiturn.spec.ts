import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Histórico de conversa multi-turno no card de IA (Fase 24, ver
 * DEVELOPMENT_PLAN.md) — até aqui cada card "ai" chamava o provedor
 * isolado (só o prompt daquela vez); agora `context.aiHistory` acumula as
 * mensagens ao longo da execução, então um segundo card "ai" no mesmo
 * fluxo enxerga o que já foi perguntado/respondido antes. Sem chave real
 * de IA disponível neste ambiente (mesma situação de Stripe/Meta) — o
 * fetch para `api.anthropic.com` é mockado, o que É suficiente para provar
 * o comportamento que é nosso: o array `messages` enviado na 2ª chamada
 * precisa conter a pergunta e a resposta da 1ª chamada.
 */
describe("Chatbot — histórico multi-turno de IA (Fase 24)", () => {
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
    const email = `${label}-${suffix}@ai-multiturn-test.local`;
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

  function mockClaudeReplyOnce(text: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text }] }),
      text: async () => JSON.stringify({ content: [{ type: "text", text }] }),
    });
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
    tenant = await signupTenant("ai-multiturn");

    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    const saveKey = await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-ant-teste-multiturn" });
    expect(saveKey.status).toBe(200);
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

  it("o 2º card de IA da mesma execução envia o histórico do 1º card para o provedor", async () => {
    const flowCreate = await tenant.agent
      .post("/chatbot/flows")
      .send({ nome: `Fluxo Multi-turno ${randomUUID().slice(0, 6)}`, aiEnabled: true });
    const flowId = flowCreate.body.id as string;

    const definition = await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send({
      nodes: [
        { id: "start", type: "start" },
        { id: "ai1", type: "ai", data: { provider: "anthropic", prompt: "Qual a capital da França?", variavel: "resposta1" } },
        { id: "ai2", type: "ai", data: { provider: "anthropic", prompt: "E a população dela?", variavel: "resposta2" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ai1" },
        { id: "e2", source: "ai1", target: "ai2" },
        { id: "e3", source: "ai2", target: "end" },
      ],
    });
    expect(definition.status).toBe(200);

    const publish = await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    expect(publish.status).toBe(201);

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    mockClaudeReplyOnce("Paris é a capital da França.");
    mockClaudeReplyOnce("Paris tem cerca de 2,1 milhões de habitantes.");

    const simulate = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955554444",
      conteudo: "Oi",
    });
    expect(simulate.status).toBe(201);

    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(firstCallBody.messages).toEqual([{ role: "user", content: "Qual a capital da França?" }]);

    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody.messages).toEqual([
      { role: "user", content: "Qual a capital da França?" },
      { role: "assistant", content: "Paris é a capital da França." },
      { role: "user", content: "E a população dela?" },
    ]);

    const execution = await prisma.chatbotExecution.findFirstOrThrow({ where: { chatbotFlowId: flowId } });
    expect(execution.status).toBe("completed");
    const contextData = execution.contextData as { answers?: Record<string, string> };
    expect(contextData.answers?.resposta1).toBe("Paris é a capital da França.");
    expect(contextData.answers?.resposta2).toBe("Paris tem cerca de 2,1 milhões de habitantes.");
  }, 20_000);
});
