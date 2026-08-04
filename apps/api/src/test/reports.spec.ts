import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração de Relatórios e Dashboard (Fase 9): dashboard
 * "Início" adaptável aos módulos ativos, relatório por módulo bloqueado
 * quando o módulo está inativo, números corretos a partir de dados reais,
 * relatório Financeiro sempre acessível (não é módulo comercializável
 * separadamente) e exportação CSV real.
 */
describe("Relatórios e Dashboard (Fase 9)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 200): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error("Timeout esperando condição.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

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
    const email = `${label}-${suffix}@reports-test.local`;
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("reports");
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("dashboard funciona sem módulos ativos (só bloco Financeiro) e /reports/crm é bloqueado (403)", async () => {
    const dashboard = await tenant.agent.get("/reports/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.modulosAtivos).toEqual([]);
    expect(dashboard.body.crm).toBeUndefined();
    expect(dashboard.body.financeiro).toBeDefined();

    const financeiro = await tenant.agent.get("/reports/financeiro");
    expect(financeiro.status).toBe(200); // financeiro não exige módulo ativo

    const crmBlocked = await tenant.agent.get("/reports/crm");
    expect(crmBlocked.status).toBe(403);
  });

  it("ativa CRM e WhatsApp, gera dados reais e reflete nos relatórios e no dashboard", async () => {
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Relatório" });
    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `Funil Relatório ${randomUUID().slice(0, 6)}` });
    const stage = await tenant.agent.post(`/crm/funnels/${funnel.body.id}/stages`).send({ nome: "Novo", ordem: 0 });
    const opportunity = await tenant.agent.post("/crm/opportunities").send({
      contactId: contact.body.id,
      funnelId: funnel.body.id,
      stageId: stage.body.id,
      valor: 500,
    });
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Follow-up",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });

    const crmReport = await tenant.agent.get("/reports/crm");
    expect(crmReport.status).toBe(200);
    expect(crmReport.body.contactsCreated).toBeGreaterThanOrEqual(1);
    expect(crmReport.body.tasksPending).toBeGreaterThanOrEqual(1);
    const stageBucket = crmReport.body.opportunitiesByStage.find((s: { stageId: string }) => s.stageId === stage.body.id);
    expect(stageBucket.count).toBeGreaterThanOrEqual(1);

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);

    const whatsappReportBefore = await tenant.agent.get("/reports/whatsapp");
    const connectedBefore = whatsappReportBefore.body.numbersByStatus.find((n: { status: string }) => n.status === "connected")?.count ?? 0;
    expect(connectedBefore).toBeGreaterThanOrEqual(1);

    const dashboard = await tenant.agent.get("/reports/dashboard");
    expect(dashboard.body.modulosAtivos.sort()).toEqual(["crm", "whatsapp"]);
    expect(dashboard.body.crm).toBeDefined();
    expect(dashboard.body.whatsapp).toBeDefined();
    expect(dashboard.body.chatbot).toBeUndefined(); // chatbot não está ativo
    expect(dashboard.body.automacao).toBeUndefined();

    const opportunityWon = await tenant.agent.patch(`/crm/opportunities/${opportunity.body.id}/close`).send({ resultado: "won", motivo: "Fechado" });
    expect(opportunityWon.status).toBe(200);
    const crmAfterWin = await tenant.agent.get("/reports/crm");
    expect(crmAfterWin.body.opportunitiesWon).toBeGreaterThanOrEqual(1);
    expect(crmAfterWin.body.conversionRate).toBeGreaterThan(0);
  }, 20_000);

  it("MRR do relatório Financeiro reflete a assinatura ativa do tenant", async () => {
    const plan = await superAdmin.post("/master/plans").send({
      nome: `Plano Relatório ${randomUUID().slice(0, 8)}`,
      preco: 240,
      recorrencia: "anual",
      modulos: [],
      limites: {},
    });
    expect(plan.status).toBe(201);

    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/plan`).send({ planId: plan.body.id });

    const financeiro = await tenant.agent.get("/reports/financeiro");
    expect(financeiro.status).toBe(200);
    expect(Number(financeiro.body.mrr)).toBeCloseTo(20, 2); // 240/ano => 20/mês
  });

  it("exporta faturas e oportunidades em CSV real", async () => {
    const invoicesCsv = await tenant.agent.get("/reports/export/invoices");
    expect(invoicesCsv.status).toBe(200);
    expect(invoicesCsv.headers["content-type"]).toContain("text/csv");
    const invoiceLines = invoicesCsv.text.trim().split("\n");
    expect(invoiceLines[0]).toBe("id,plano,valor,status,metodo,vencimento,pagoEm,criadaEm");
    expect(invoiceLines.length).toBeGreaterThanOrEqual(2); // cabeçalho + ao menos 1 fatura (gerada pela concessão de plano)

    const opportunitiesCsv = await tenant.agent.get("/reports/export/opportunities");
    expect(opportunitiesCsv.status).toBe(200);
    expect(opportunitiesCsv.headers["content-type"]).toContain("text/csv");
    const oppLines = opportunitiesCsv.text.trim().split("\n");
    expect(oppLines[0]).toBe("id,contato,etapa,valor,status,criadaEm");
    expect(oppLines.length).toBeGreaterThanOrEqual(2);
  });

  it("exporta contatos, mensagens, conversas e execuções (chatbot/automação) em CSV real", async () => {
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "automacao", enabled: true });

    const contactsCsv = await tenant.agent.get("/reports/export/contacts");
    expect(contactsCsv.status).toBe(200);
    expect(contactsCsv.headers["content-type"]).toContain("text/csv");
    const contactLines = contactsCsv.text.trim().split("\n");
    expect(contactLines[0]).toBe("id,nome,sobrenome,documento,telefone,email,origem,campanha,responsavel,criadoEm");
    expect(contactLines.length).toBeGreaterThanOrEqual(2); // pelo menos o "Cliente Relatório" criado antes

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);

    const simulate = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511988887777",
      conteudo: "Olá, preciso de ajuda",
    });
    expect(simulate.status).toBe(201);

    const messagesCsv = await tenant.agent.get("/reports/export/messages");
    expect(messagesCsv.status).toBe(200);
    const messageLines = messagesCsv.text.trim().split("\n");
    expect(messageLines[0]).toBe("id,conversa,contatoNumero,direcao,tipo,statusEntrega,criadaEm");
    expect(messageLines.length).toBeGreaterThanOrEqual(2);

    const conversationsCsv = await tenant.agent.get("/reports/export/conversations");
    expect(conversationsCsv.status).toBe(200);
    const conversationLines = conversationsCsv.text.trim().split("\n");
    expect(conversationLines[0]).toBe("id,contatoNumero,fila,responsavel,status,prioridade,criadaEm,ultimaMensagemEm");
    expect(conversationLines.length).toBeGreaterThanOrEqual(2);

    // Execução de chatbot: fluxo mínimo (start -> mensagem -> end) disparado pela conversa já criada.
    const flowCreate = await tenant.agent.post("/chatbot/flows").send({ nome: `Fluxo Export ${randomUUID().slice(0, 6)}` });
    const flowId = flowCreate.body.id as string;
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send({
      nodes: [
        { id: "start", type: "start" },
        { id: "welcome", type: "message", data: { texto: "Olá!" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "welcome" },
        { id: "e2", source: "welcome", target: "end" },
      ],
    });
    await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);

    // Vincular fluxo exige número do tipo "chatbot" (numberId acima é "atendente").
    const botNumberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const botNumberId = botNumberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${botNumberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${botNumberId}/confirm-connection`);
    await tenant.agent.patch(`/whatsapp/numbers/${botNumberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: botNumberId,
      fromNumero: "5511977776666",
      conteudo: "Oi",
    });
    await waitFor(() => prisma.chatbotExecution.findFirst({ where: { chatbotFlowId: flowId, status: "completed" } }));

    const chatbotCsv = await tenant.agent.get("/reports/export/chatbot-executions");
    expect(chatbotCsv.status).toBe(200);
    const chatbotLines = chatbotCsv.text.trim().split("\n");
    expect(chatbotLines[0]).toBe("id,fluxo,versao,status,iniciadaEm,finalizadaEm");
    expect(chatbotLines.length).toBeGreaterThanOrEqual(2);

    // Execução de automação: gatilho crm_task.created + ação simples (apply_tag), mesmo padrão de automation.spec.ts.
    const automation = await tenant.agent.post("/automation/rules").send({
      nome: `Automação Export ${randomUUID().slice(0, 6)}`,
      gatilhoTipo: "crm_task.created",
      acoes: [{ tipo: "apply_tag", tag: "export-test" }],
    });
    expect(automation.status).toBe(201);
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Export Automação" });
    await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Tarefa para gerar execução",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });
    await waitFor(() => prisma.automationExecution.findFirst({ where: { automationId: automation.body.id, status: "success" } }));

    const automationCsv = await tenant.agent.get("/reports/export/automation-executions");
    expect(automationCsv.status).toBe(200);
    const automationLines = automationCsv.text.trim().split("\n");
    expect(automationLines[0]).toBe("id,automacao,gatilhoDisparado,tentativas,status,erro,criadaEm");
    expect(automationLines.length).toBeGreaterThanOrEqual(2);
  }, 20_000);

  it("isolamento: outro tenant não vê dados de relatórios deste tenant", async () => {
    const other = await signupTenant("reports-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "crm", enabled: true });

    const financeiro = await other.agent.get("/reports/financeiro");
    expect(financeiro.body.mrr).toBe("0.00");

    const crmReport = await other.agent.get("/reports/crm");
    expect(crmReport.body.contactsCreated).toBe(0);

    const invoicesCsv = await other.agent.get("/reports/export/invoices");
    const lines = invoicesCsv.text.trim().split("\n");
    expect(lines).toHaveLength(1); // só o cabeçalho

    const contactsCsv = await other.agent.get("/reports/export/contacts");
    expect(contactsCsv.text.trim().split("\n")).toHaveLength(1);
  });
});
