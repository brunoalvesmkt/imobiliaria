import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 43 (ver DEVELOPMENT_PLAN.md): critérios de avaliação de qualidade
 * (peso, obrigatório, nota mínima) editáveis por tenant — prompt mestre
 * §12.2. A nota geral final passa a ser a média ponderada pelos pesos
 * configurados, calculada pelo backend (não a que a IA reportou).
 */
describe("Configuração de critérios de qualidade (Fase 43)", () => {
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
    const email = `${label}-${suffix}@qualityconfig-test.local`;
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

    tenant = await signupTenant("qualitycfg");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "qualidade_ia", enabled: true });
    await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "ia", enabled: true, config: { allowByok: true, allowPlatformKey: false } });
    await tenant.agent.patch("/ai/credentials/anthropic").send({ apiKey: "sk-ant-teste-qualitycfg" });

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

  it("GET devolve os 13 critérios padrão com peso 1, e PATCH substitui pelos critérios do tenant", async () => {
    const before = await tenant.agent.get("/atendimento/quality-config");
    expect(before.status).toBe(200);
    expect(before.body.criterios).toHaveLength(13);
    expect(before.body.notaMinima).toBe(6);

    const update = await tenant.agent.patch("/atendimento/quality-config").send({
      criterios: [
        { nome: "Cordialidade", peso: 3, obrigatorio: true },
        { nome: "Rapidez", peso: 1, obrigatorio: false },
      ],
      notaMinima: 7,
    });
    expect(update.status).toBe(200);

    const after = await tenant.agent.get("/atendimento/quality-config");
    expect(after.body.criterios).toEqual([
      { nome: "Cordialidade", peso: 3, obrigatorio: true },
      { nome: "Rapidez", peso: 1, obrigatorio: false },
    ]);
    expect(after.body.notaMinima).toBe(7);
  });

  it("rejeita lista de critérios vazia", async () => {
    const res = await tenant.agent.patch("/atendimento/quality-config").send({ criterios: [], notaMinima: 6 });
    expect(res.status).toBe(400);
  });

  it("a nota geral final é a média ponderada pelos pesos configurados, não a que a IA reportou", async () => {
    await tenant.agent.patch("/atendimento/quality-config").send({
      criterios: [
        { nome: "Cordialidade", peso: 3, obrigatorio: false },
        { nome: "Rapidez", peso: 1, obrigatorio: false },
      ],
      notaMinima: 6,
    });

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511922223333",
      conteudo: "Preciso de ajuda",
    });
    const conversationId = incoming.body.conversationId as string;

    // IA reporta 5.0, mas os critérios pesados dão (10*3 + 2*1) / 4 = 8.0.
    mockClaudeAnalysis({
      notaGeral: 5.0,
      classificacao: "bom",
      criteriosAvaliados: [
        { nome: "Cordialidade", nota: 10, comentario: "Excelente" },
        { nome: "Rapidez", nota: 2, comentario: "Demorou" },
      ],
      pontosPositivos: [],
      pontosMelhoria: [],
      oportunidadesPerdidas: [],
      momentosCriticos: [],
      sugestoes: [],
      resumoExecutivo: "Atendimento cordial, porém lento.",
    });

    const analyze = await tenant.agent.post(`/atendimento/inbox/${conversationId}/analysis`);
    expect(analyze.status).toBe(201);
    expect(analyze.body.notaGeral).toBe(8);
  });
});
