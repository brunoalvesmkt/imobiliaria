import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 40 (ver DEVELOPMENT_PLAN.md): Funcionalidade 12 do prompt mestre
 * ("Análise de Atendimentos com IA — Versão 2.0"), antecipada a pedido do
 * usuário mesmo o próprio documento a descrevendo como versão futura. Gate
 * próprio ("qualidade_ia", separado de "atendimento") para que o Master
 * ligue/desligue a funcionalidade a qualquer momento sem afetar o resto do
 * Atendimento — é exatamente isso que o primeiro teste comprova.
 */
describe("Análise de Atendimento com IA — Funcionalidade 12 (Fase 40)", () => {
  let app: INestApplication;
  let originalFetch: typeof fetch;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  function mockClaudeAnalysis(json: Record<string, unknown>) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: "text", text: JSON.stringify(json) }] }),
      text: async () => JSON.stringify({ content: [{ type: "text", text: JSON.stringify(json) }] }),
    });
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@quality-test.local`;
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("quality");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
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

  it("é uma funcionalidade opt-in: desligada por padrão, e desligá-la não afeta o resto do Atendimento", async () => {
    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955551111",
      conteudo: "Quero um orçamento",
    });
    const conversationId = incoming.body.conversationId as string;

    const analyzeDisabled = await tenant.agent.post(`/atendimento/inbox/${conversationId}/analysis`);
    expect(analyzeDisabled.status).toBe(403);

    // O resto do Atendimento continua funcionando normalmente com o módulo desligado.
    const assume = await tenant.agent.post(`/atendimento/inbox/${conversationId}/assume`);
    expect(assume.status).toBe(201);
    const close = await tenant.agent.post(`/atendimento/inbox/${conversationId}/close`);
    expect(close.status).toBe(201);
  });

  it("ligando o módulo, gera uma avaliação real (nota, critérios, resumo) e some do histórico de novo ao desligar", async () => {
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    const saveKey = await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-ant-teste-quality" });
    expect(saveKey.status).toBe(200);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955552222",
      conteudo: "Quero saber o preço do plano",
    });
    const conversationId = incoming.body.conversationId as string;

    mockClaudeAnalysis({
      notaGeral: 8.5,
      classificacao: "bom",
      // notaGeral final é recalculada como média ponderada de criteriosAvaliados
      // (Fase 43, pesos configuráveis) — 9 e 8 com peso padrão 1 cada dá 8.5,
      // igual ao notaGeral que a IA reportou, para não quebrar a asserção abaixo.
      criteriosAvaliados: [
        { nome: "Cordialidade", nota: 9, comentario: "Educado" },
        { nome: "Clareza", nota: 8, comentario: "Direto ao ponto" },
      ],
      pontosPositivos: ["Respondeu rápido"],
      pontosMelhoria: ["Poderia detalhar mais os planos"],
      oportunidadesPerdidas: ["Não ofereceu upsell"],
      momentosCriticos: [],
      sugestoes: ["Perguntar o orçamento do cliente"],
      resumoExecutivo: "Atendimento cordial e rápido, sem grandes falhas.",
    });

    const analyze = await tenant.agent.post(`/atendimento/inbox/${conversationId}/analysis`);
    expect(analyze.status).toBe(201);
    expect(analyze.body.notaGeral).toBe(8.5);
    expect(analyze.body.classificacao).toBe("bom");
    expect(analyze.body.resumoExecutivo).toContain("cordial");
    expect(analyze.body.modeloUtilizado).toBe("anthropic");

    const history = await tenant.agent.get(`/atendimento/inbox/${conversationId}/analysis`);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);

    // Desligando de novo, a rota volta a ser bloqueada — reversível a qualquer momento.
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: false });
    const afterDisable = await tenant.agent.get(`/atendimento/inbox/${conversationId}/analysis`);
    expect(afterDisable.status).toBe(403);
  });
});
