import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import type { FlowDefinition } from "../chatbot/flow-definition.types";

/**
 * Testes de integração do módulo Chatbot (Fase 6): fluxo real disparado
 * automaticamente por uma conversa nova, pergunta com validação + gravação
 * no CRM, menu com ramificação, subfluxo com retorno automático, proteção
 * de tentativas esgotadas (transferência), condição true/false, e a
 * validação de publicação (nós órfãos / ciclo sem saída).
 */
describe("Chatbot (Fase 6)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

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
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  async function createNumber(): Promise<string> {
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({ versaoTermo: "1.0" });
    return numberId;
  }

  async function createFlow(nome: string, definicao: FlowDefinition) {
    const create = await tenant.agent.post("/chatbot/flows").send({ nome });
    const flowId = create.body.id as string;
    const update = await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definicao);
    if (update.status !== 200) {
      throw new Error(`Falha ao atualizar definição: ${update.status} ${JSON.stringify(update.body)}`);
    }
    return flowId;
  }

  async function publishFlow(flowId: string) {
    const res = await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    expect(res.status).toBe(201);
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

    tenant = await signupTenant("bot");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("rejeita publicar fluxo com nó órfão / sem card de início", async () => {
    const create = await tenant.agent.post("/chatbot/flows").send({ nome: `Fluxo Invalido ${randomUUID().slice(0, 6)}` });
    const flowId = create.body.id as string;

    const brokenDefinition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "orphan", type: "message", data: { texto: "Nunca alcançado" } },
      ],
      edges: [], // start sem nenhuma saída, orphan inalcançável
    };
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(brokenDefinition);

    const publish = await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    expect(publish.status).toBe(400);
    expect(publish.body.errors.length).toBeGreaterThan(0);
  });

  it("fluxo completo: mensagem, pergunta com validação + gravação no CRM, menu, subfluxo com retorno", async () => {
    const subDefinition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "msg-sub", type: "message", data: { texto: "Você escolheu comprar! Em breve um vendedor te chama." } },
        { id: "end-sub", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "msg-sub" },
        { id: "e2", source: "msg-sub", target: "end-sub" },
      ],
    };
    const subflowId = await createFlow(`Subfluxo Compra ${randomUUID().slice(0, 6)}`, subDefinition);
    await publishFlow(subflowId);

    const mainDefinition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "welcome", type: "message", data: { texto: "Bem-vindo à loja!" } },
        {
          id: "ask-name",
          type: "question",
          data: { texto: "Qual seu nome?", variavel: "nome", validacao: "texto", salvarNoCrm: "nomeCompleto" },
        },
        {
          id: "menu-intent",
          type: "menu",
          data: {
            texto: "O que você deseja?",
            variavel: "opcao",
            opcoes: [
              { chave: "1", texto: "Comprar" },
              { chave: "2", texto: "Suporte" },
            ],
          },
        },
        { id: "call-subflow", type: "subflow", data: { subflowId } },
        { id: "transfer-support", type: "transfer", data: {} },
        { id: "end-main", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "welcome" },
        { id: "e2", source: "welcome", target: "ask-name" },
        { id: "e3", source: "ask-name", target: "menu-intent" },
        { id: "e4", source: "menu-intent", sourceHandle: "1", target: "call-subflow" },
        { id: "e5", source: "menu-intent", sourceHandle: "2", target: "transfer-support" },
        { id: "e6", source: "call-subflow", target: "end-main" },
      ],
    };
    const flowId = await createFlow(`Atendimento Inicial ${randomUUID().slice(0, 6)}`, mainDefinition);
    await publishFlow(flowId);

    const numberId = await createNumber();
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const contatoNumero = `5511977778888`;

    // 1ª mensagem do cliente: dispara o fluxo automaticamente (start -> welcome -> ask-name, pausa esperando resposta).
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    expect(first.status).toBe(201);
    const conversationId = first.body.conversationId as string;

    let execution = await prisma.chatbotExecution.findFirstOrThrow({ where: { conversationId } });
    expect(execution.status).toBe("running");
    expect(execution.currentNodeId).toBe("ask-name");

    // Responde o nome — deve avançar até o menu (pausa novamente).
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Fulano da Silva",
    });
    execution = await prisma.chatbotExecution.findUniqueOrThrow({ where: { id: execution.id } });
    expect(execution.currentNodeId).toBe("menu-intent");

    // Verifica gravação automática no CRM (salvarNoCrm).
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, whatsapp: contatoNumero } });
    expect((contact.customFields as Record<string, unknown>).nomeCompleto).toBe("Fulano da Silva");

    // Escolhe "1" (comprar) — entra no subfluxo, manda a mensagem do subfluxo, retorna e conclui.
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "1",
    });
    execution = await prisma.chatbotExecution.findUniqueOrThrow({ where: { id: execution.id } });
    expect(execution.status).toBe("completed");
    expect(execution.finishedAt).not.toBeNull();

    const conversation = await tenant.agent.get(`/whatsapp/conversations/${conversationId}`);
    const botMessages = conversation.body.messages.filter((m: { senderType: string }) => m.senderType === "chatbot");
    expect(botMessages.some((m: { conteudo: string }) => m.conteudo.includes("comprar"))).toBe(true);
  });

  it("condição: ramifica true/false corretamente", async () => {
    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask-age", type: "question", data: { texto: "Qual sua idade?", variavel: "idade", validacao: "numero" } },
        { id: "cond", type: "condition", data: { campo: "idade", operador: "equals", valor: "18" } },
        { id: "msg-adult", type: "message", data: { texto: "Você tem exatamente 18 anos." } },
        { id: "msg-other", type: "message", data: { texto: "Você não tem 18 anos." } },
        { id: "end-adult", type: "end" },
        { id: "end-other", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask-age" },
        { id: "e2", source: "ask-age", target: "cond" },
        { id: "e3", source: "cond", sourceHandle: "true", target: "msg-adult" },
        { id: "e4", source: "cond", sourceHandle: "false", target: "msg-other" },
        { id: "e5", source: "msg-adult", target: "end-adult" },
        { id: "e6", source: "msg-other", target: "end-other" },
      ],
    };
    const flowId = await createFlow(`Fluxo Condicao ${randomUUID().slice(0, 6)}`, definition);
    await publishFlow(flowId);

    const numberId = await createNumber();
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const numero = "5511955559999";
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: numero,
      conteudo: "Oi",
    });
    const conversationId = first.body.conversationId as string;

    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: numero,
      conteudo: "18",
    });

    const conversation = await tenant.agent.get(`/whatsapp/conversations/${conversationId}`);
    const lastBotMessage = conversation.body.messages
      .filter((m: { senderType: string }) => m.senderType === "chatbot")
      .at(-1);
    expect(lastBotMessage.conteudo).toContain("exatamente 18");
  });

  it("pergunta com validação inválida repetidamente transfere para atendente humano", async () => {
    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask-email", type: "question", data: { texto: "Qual seu e-mail?", variavel: "email", validacao: "email", maxTentativas: 2 } },
        { id: "end1", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask-email" },
        { id: "e2", source: "ask-email", target: "end1" },
      ],
    };
    const flowId = await createFlow(`Fluxo Retry ${randomUUID().slice(0, 6)}`, definition);
    await publishFlow(flowId);

    const numberId = await createNumber();
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const numero = "5511944443333";
    const first = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: numero,
      conteudo: "oi",
    });
    const conversationId = first.body.conversationId as string;

    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: numero,
      conteudo: "não é um email",
    });
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: numero,
      conteudo: "ainda não é um email",
    });

    const execution = await prisma.chatbotExecution.findFirstOrThrow({ where: { conversationId } });
    expect(execution.status).toBe("transferred");
  });

  it("isolamento: outro tenant não vê fluxos deste tenant", async () => {
    const other = await signupTenant("bot-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "chatbot", enabled: true });

    const flows = await other.agent.get("/chatbot/flows");
    expect(flows.body).toHaveLength(0);
  });
});
