import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Busca semântica (embeddings) na Base de Conhecimento (Fase 25, ver
 * DEVELOPMENT_PLAN.md) — o card "Consulta à Base" passou de pontuação por
 * palavra-chave para vetores de embedding quando o provedor suporta (OpenAI
 * e Google; a Anthropic não tem API de embeddings própria, cai para
 * palavra-chave automaticamente). Sem chave real de IA disponível neste
 * ambiente — `fetch` para `api.openai.com` é mockado com vetores
 * artificiais que deixam o resultado do "vencedor" da busca previsível e
 * verificável (o item cujo vetor é idêntico ao da pergunta).
 */
describe("Chatbot — busca semântica na Base de Conhecimento (Fase 25)", () => {
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
    const email = `${label}-${suffix}@ai-semantic-test.local`;
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

  function mockEmbeddingOnce(vector: number[]) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: vector }] }),
      text: async () => JSON.stringify({ data: [{ embedding: vector }] }),
    });
  }

  function mockChatCompletionOnce(text: string) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: text } }] }),
      text: async () => JSON.stringify({ choices: [{ message: { content: text } }] }),
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
    tenant = await signupTenant("ai-semantic");

    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    const saveKey = await tenant.agent.patch("/ai/credentials/openai").send({ apiKey: "sk-teste-semantica" });
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

  it("escolhe o item da base de conhecimento com o vetor mais próximo da pergunta, e cacheia o embedding calculado", async () => {
    const itemFrete = await tenant.agent.post("/chatbot/knowledge-base").send({
      tipo: "faq",
      titulo: "Prazo de entrega",
      conteudo: "O prazo de entrega é de 5 a 7 dias úteis.",
    });
    expect(itemFrete.status).toBe(201);
    const itemPagamento = await tenant.agent.post("/chatbot/knowledge-base").send({
      tipo: "faq",
      titulo: "Formas de pagamento",
      conteudo: "Aceitamos Pix, boleto e cartão de crédito.",
    });
    expect(itemPagamento.status).toBe(201);

    const flowCreate = await tenant.agent
      .post("/chatbot/flows")
      .send({ nome: `Fluxo Busca Semântica ${randomUUID().slice(0, 6)}`, aiEnabled: true });
    const flowId = flowCreate.body.id as string;
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send({
      nodes: [
        { id: "start", type: "start" },
        { id: "ask", type: "question", data: { texto: "Como posso ajudar?", variavel: "pergunta", validacao: "texto" } },
        { id: "kq", type: "knowledge_query", data: { provider: "openai", tipo: "faq", variavel: "resposta" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask" },
        { id: "e2", source: "ask", target: "kq" },
        { id: "e3", source: "kq", target: "end" },
      ],
    });
    await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    // Vetores artificiais: a pergunta ("Qual o prazo de entrega?") é idêntica ao vetor do item "Prazo de entrega"
    // e ortogonal ao de "Formas de pagamento" — a busca semântica deve escolher o primeiro.
    mockEmbeddingOnce([1, 0, 0]); // embedding da pergunta
    mockEmbeddingOnce([1, 0, 0]); // embedding do item "Prazo de entrega" (calculado agora, sem cache)
    mockEmbeddingOnce([0, 1, 0]); // embedding do item "Formas de pagamento" (calculado agora, sem cache)
    mockChatCompletionOnce("O prazo é de 5 a 7 dias úteis.");

    const contatoNumero = "5511944443333";
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    expect(first.status).toBe(201);

    const simulate = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Qual o prazo de entrega?",
    });
    expect(simulate.status).toBe(201);

    expect(global.fetch).toHaveBeenCalledTimes(4);

    // A 4ª chamada é a completion — o item com vetor idêntico ao da pergunta ("Prazo de
    // entrega", similaridade 1.0) deve aparecer primeiro no systemPrompt, antes do item
    // ortogonal ("Formas de pagamento", similaridade 0) — prova que o ranking por
    // similaridade de cosseno funcionou, não uma ordem arbitrária.
    const completionBody = JSON.parse((global.fetch as jest.Mock).mock.calls[3][1].body);
    const systemMessage = completionBody.messages.find((m: { role: string }) => m.role === "system");
    const posFrete = systemMessage.content.indexOf("Prazo de entrega");
    const posPagamento = systemMessage.content.indexOf("Formas de pagamento");
    expect(posFrete).toBeGreaterThanOrEqual(0);
    expect(posPagamento).toBeGreaterThanOrEqual(0);
    expect(posFrete).toBeLessThan(posPagamento);

    const execution = await prisma.chatbotExecution.findFirstOrThrow({ where: { chatbotFlowId: flowId } });
    const contextData = execution.contextData as { answers?: Record<string, string> };
    expect(contextData.answers?.resposta).toBe("O prazo é de 5 a 7 dias úteis.");

    // O embedding calculado foi cacheado no item — uma segunda busca não deveria recalculá-lo.
    const updatedItem = await prisma.knowledgeBaseItem.findUniqueOrThrow({ where: { id: itemFrete.body.id } });
    expect(updatedItem.embedding).toEqual([1, 0, 0]);
  }, 20_000);
});
