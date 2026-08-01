import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import type { FlowDefinition } from "../chatbot/flow-definition.types";

/**
 * Testes de integração da integração com IA (Claude/ChatGPT/Gemini):
 * permissão por FeatureFlag ("ia" + config allowByok/allowPlatformKey),
 * cadastro/remoção de chave própria do tenant (BYOK), e o card "ai" do
 * motor do Chatbot transferindo para humano quando não há chave disponível
 * — chamar um provedor real de verdade exigiria uma API key real, fora do
 * escopo deste ambiente de teste (mesma situação do Meta/gateway de
 * pagamento em fases anteriores).
 */
describe("Integração com IA", () => {
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
    const email = `${label}-${suffix}@chatbot-test.local`;
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

  async function toggleIaModule(enabled: boolean, config?: Record<string, unknown>) {
    const res = await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled, ...(config ? { config } : {}) });
    expect(res.status).toBe(200);
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

    tenant = await signupTenant("ia");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("nega acesso quando o módulo de IA não está habilitado", async () => {
    const access = await tenant.agent.get("/ai/access");
    expect(access.status).toBe(200);
    expect(access.body.enabled).toBe(false);
    expect(access.body.providers.every((p: { usable: boolean }) => p.usable === false)).toBe(true);
  });

  it("BYOK: cadastrar e remover a própria chave reflete em /ai/access", async () => {
    await toggleIaModule(true, { allowByok: true, allowPlatformKey: false });

    const before = await tenant.agent.get("/ai/access");
    expect(before.body.allowByok).toBe(true);
    expect(before.body.providers.find((p: { provider: string }) => p.provider === "anthropic").hasOwnKey).toBe(false);

    const save = await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-test-chave-fake-0000" });
    expect(save.status).toBe(200);

    const after = await tenant.agent.get("/ai/access");
    const anthropic = after.body.providers.find((p: { provider: string }) => p.provider === "anthropic");
    expect(anthropic.hasOwnKey).toBe(true);
    expect(anthropic.usable).toBe(true);

    // A chave nunca é devolvida em texto puro por nenhum endpoint.
    expect(JSON.stringify(after.body)).not.toContain("sk-test-chave-fake-0000");

    const del = await tenant.agent.delete("/ai/credentials/anthropic");
    expect(del.status).toBe(200);
    const afterDelete = await tenant.agent.get("/ai/access");
    expect(afterDelete.body.providers.find((p: { provider: string }) => p.provider === "anthropic").hasOwnKey).toBe(false);
  });

  it("rejeita cadastrar chave própria quando allowByok está desligado", async () => {
    await toggleIaModule(true, { allowByok: false, allowPlatformKey: true });

    const save = await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-test-outra-chave-0000" });
    expect(save.status).toBe(403);
  });

  it("chave da plataforma: usable segue platformKeyConfigured (vazio neste ambiente de teste)", async () => {
    await toggleIaModule(true, { allowByok: false, allowPlatformKey: true });

    const access = await tenant.agent.get("/ai/access");
    expect(access.body.allowPlatformKey).toBe(true);
    // Sem AI_PLATFORM_*_API_KEY configurado neste ambiente, nenhum provedor fica utilizável.
    expect(access.body.providers.every((p: { platformKeyConfigured: boolean }) => p.platformKeyConfigured === false)).toBe(true);
    expect(access.body.providers.every((p: { usable: boolean }) => p.usable === false)).toBe(true);
  });

  it("publicação rejeita card de IA em fluxo sem 'Habilitar IA'", async () => {
    const create = await tenant.agent.post("/chatbot/flows").send({ nome: `Fluxo IA sem flag ${randomUUID().slice(0, 6)}` });
    const flowId = create.body.id as string;

    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "pergunta-ia", type: "ai", data: { provider: "anthropic", prompt: "Responda educadamente." } },
        { id: "end1", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "pergunta-ia" },
        { id: "e2", source: "pergunta-ia", target: "end1" },
      ],
    };
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definition);

    const publish = await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    expect(publish.status).toBe(400);
    expect(JSON.stringify(publish.body.errors)).toContain("IA habilitada");
  });

  it("card de IA sem chave disponível transfere a conversa para um atendente humano", async () => {
    await toggleIaModule(false);

    const create = await tenant.agent.post("/chatbot/flows").send({
      nome: `Fluxo IA sem chave ${randomUUID().slice(0, 6)}`,
      aiEnabled: true,
    });
    const flowId = create.body.id as string;

    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "pergunta-ia", type: "ai", data: { provider: "anthropic", prompt: "Responda educadamente." } },
        { id: "end1", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "pergunta-ia" },
        { id: "e2", source: "pergunta-ia", target: "end1" },
      ],
    };
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definition);
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
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({ versaoTermo: "1.0" });
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511933332222",
      conteudo: "Oi",
    });
    expect(first.status).toBe(201);
    const conversationId = first.body.conversationId as string;

    const execution = await prisma.chatbotExecution.findFirstOrThrow({ where: { conversationId } });
    expect(execution.status).toBe("transferred");

    const conversation = await tenant.agent.get(`/whatsapp/conversations/${conversationId}`);
    const lastBotMessage = conversation.body.messages
      .filter((m: { senderType: string }) => m.senderType === "chatbot")
      .at(-1);
    expect(lastBotMessage.conteudo).toContain("transferir");
  });

  it("isolamento: outro tenant não vê chave/config de IA deste tenant", async () => {
    await toggleIaModule(true, { allowByok: true, allowPlatformKey: false });
    await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-test-isolamento-0000" });

    const other = await signupTenant("ia-other");
    const otherAccess = await other.agent.get("/ai/access");
    expect(otherAccess.body.enabled).toBe(false);
    expect(otherAccess.body.providers.find((p: { provider: string }) => p.provider === "anthropic").hasOwnKey).toBe(false);
  });
});
