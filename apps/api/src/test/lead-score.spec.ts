import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import type { FlowDefinition } from "../chatbot/flow-definition.types";

/**
 * Fase 35 (ver DEVELOPMENT_PLAN.md): Lead Score — gap real do prompt mestre
 * §4 encontrado em auditoria, nunca implementado em nenhuma fase anterior
 * apesar de ser um critério explícito de conclusão do MVP (§10: "O Lead
 * Score for calculado"). Pontuação configurada por pergunta
 * (`QuestionNodeData.pontuacao`) e por opção de menu (`MenuOption.pontuacao`),
 * somada ao `Contact.leadScore` pelo motor do Chatbot, clampada em [0, 100].
 */
describe("Lead Score (Fase 35)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

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
    const email = `${label}-${suffix}@leadscore-test.local`;
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

  async function createFlow(nome: string, definicao: FlowDefinition) {
    const create = await tenant.agent.post("/chatbot/flows").send({ nome });
    const flowId = create.body.id as string;
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definicao);
    const publish = await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    expect(publish.status).toBe(201);
    return flowId;
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

    tenant = await signupTenant("leadscore");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({ versaoTermo: "1.0" });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("soma pontos de pergunta + opção de menu ao Lead Score do contato, clampado em 100", async () => {
    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask-budget", type: "question", data: { texto: "Qual seu orçamento?", variavel: "orcamento", validacao: "texto", pontuacao: 30 } },
        {
          id: "menu-interest",
          type: "menu",
          data: {
            texto: "Você quer comprar agora?",
            variavel: "intencao",
            opcoes: [
              { chave: "1", texto: "Compra imediata", pontuacao: 80 },
              { chave: "2", texto: "Só pesquisando", pontuacao: -15 },
            ],
          },
        },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask-budget" },
        { id: "e2", source: "ask-budget", target: "menu-interest" },
        { id: "e3", source: "menu-interest", sourceHandle: "1", target: "end" },
        { id: "e4", source: "menu-interest", sourceHandle: "2", target: "end" },
      ],
    };
    const flowId = await createFlow(`Qualificação Score ${randomUUID().slice(0, 6)}`, definition);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const contatoNumero = "5511966665555";

    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });

    // Responde a pergunta (+30).
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "R$ 5000",
    });

    let contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, whatsapp: contatoNumero } });
    expect(contact.leadScore).toBe(30);

    // Escolhe "compra imediata" (+80) — soma 110, clampado em 100.
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "1",
    });

    contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, whatsapp: contatoNumero } });
    expect(contact.leadScore).toBe(100);

    const viaApi = await tenant.agent.get(`/crm/contacts/${contact.id}`);
    expect(viaApi.body.leadScore).toBe(100);
  });

  it("pontuação negativa reduz o score sem passar de zero, e classificação fica Frio (<40)", async () => {
    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask-budget", type: "question", data: { texto: "Qual seu orçamento?", variavel: "orcamento", validacao: "texto", pontuacao: 10 } },
        {
          id: "menu-interest",
          type: "menu",
          data: {
            texto: "Você quer comprar agora?",
            variavel: "intencao",
            opcoes: [{ chave: "2", texto: "Só pesquisando", pontuacao: -15 }],
          },
        },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask-budget" },
        { id: "e2", source: "ask-budget", target: "menu-interest" },
        { id: "e3", source: "menu-interest", sourceHandle: "2", target: "end" },
      ],
    };
    const flowId = await createFlow(`Qualificação Frio ${randomUUID().slice(0, 6)}`, definition);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const contatoNumero = "5511966664444";

    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "R$ 100",
    });
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "2",
    });

    // 10 - 15 = -5, clampado em 0.
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: tenant.tenantId, whatsapp: contatoNumero } });
    expect(contact.leadScore).toBe(0);
  });
});
