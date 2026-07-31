import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 44 (ver DEVELOPMENT_PLAN.md): "Dashboard de qualidade" e "Evolução
 * dos atendentes" do prompt mestre §12 — média por atendente, evolução
 * mensal, pontos fortes/fracos recorrentes, a partir de `ConversationEvaluation`.
 */
describe("Relatório de Qualidade (Fase 44)", () => {
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
    const email = `${label}-${suffix}@qualitydash-test.local`;
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

    tenant = await signupTenant("qualitydash");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-ant-teste-qualitydash" });

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

  it("agrega média por atendente e pontos recorrentes a partir das avaliações", async () => {
    const incoming1 = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511933334444",
      conteudo: "Oi 1",
    });
    const conversation1 = incoming1.body.conversationId as string;
    await tenant.agent.post(`/atendimento/inbox/${conversation1}/assume`);

    const incoming2 = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511933335555",
      conteudo: "Oi 2",
    });
    const conversation2 = incoming2.body.conversationId as string;
    await tenant.agent.post(`/atendimento/inbox/${conversation2}/assume`);

    mockClaudeAnalysis({
      notaGeral: 9,
      classificacao: "excelente",
      criteriosAvaliados: [{ nome: "Cordialidade", nota: 9, comentario: "" }],
      pontosPositivos: ["Respondeu rápido"],
      pontosMelhoria: [],
      oportunidadesPerdidas: [],
      momentosCriticos: [],
      sugestoes: [],
      resumoExecutivo: "Ótimo.",
    });
    await tenant.agent.post(`/atendimento/inbox/${conversation1}/analysis`);

    mockClaudeAnalysis({
      notaGeral: 7,
      classificacao: "bom",
      criteriosAvaliados: [{ nome: "Cordialidade", nota: 7, comentario: "" }],
      pontosPositivos: ["Respondeu rápido"],
      pontosMelhoria: ["Poderia detalhar mais"],
      oportunidadesPerdidas: [],
      momentosCriticos: [],
      sugestoes: [],
      resumoExecutivo: "Bom.",
    });
    await tenant.agent.post(`/atendimento/inbox/${conversation2}/analysis`);

    const dashboard = await tenant.agent.get("/reports/qualidade");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totalAvaliacoes).toBe(2);
    expect(dashboard.body.notaMedia).toBe(8);

    // Mesmo atendente (tenant.userId assumiu as duas) — uma linha só, média (9+7)/2=8.
    expect(dashboard.body.mediaPorAtendente).toHaveLength(1);
    expect(dashboard.body.mediaPorAtendente[0].id).toBe(tenant.userId);
    expect(dashboard.body.mediaPorAtendente[0].media).toBe(8);
    expect(dashboard.body.mediaPorAtendente[0].avaliacoes).toBe(2);

    // "Respondeu rápido" aparece nas duas avaliações — recorrente.
    const forte = dashboard.body.pontosFortesRecorrentes.find((p: { texto: string }) => p.texto === "Respondeu rápido");
    expect(forte.count).toBe(2);

    expect(dashboard.body.evolucaoMensal.length).toBeGreaterThanOrEqual(1);
  });

  it("bloqueia o relatório quando o módulo de qualidade está desligado", async () => {
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: false });
    const res = await tenant.agent.get("/reports/qualidade");
    expect(res.status).toBe(403);
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: true });
  });
});
