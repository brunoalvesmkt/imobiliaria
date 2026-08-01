import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import type { FlowDefinition } from "../chatbot/flow-definition.types";

/**
 * Fase 42 (ver DEVELOPMENT_PLAN.md): limiares de classificação do Lead
 * Score (Frio/Morno/Quente) editáveis por tenant — prompt mestre §4 ("os
 * intervalos deverão ser editáveis").
 */
describe("Configuração de limiares do Lead Score (Fase 42)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

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
    const email = `${label}-${suffix}@leadscoreconfig-test.local`;
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

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("leadcfg");
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
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("GET devolve os limiares padrão (40/70) quando nunca configurados, e PATCH atualiza", async () => {
    const before = await tenant.agent.get("/crm/lead-score-config");
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ morno: 40, quente: 70 });

    const update = await tenant.agent.patch("/crm/lead-score-config").send({ morno: 20, quente: 50 });
    expect(update.status).toBe(200);
    expect(update.body).toEqual({ morno: 20, quente: 50 });

    const after = await tenant.agent.get("/crm/lead-score-config");
    expect(after.body).toEqual({ morno: 20, quente: 50 });
  });

  it("rejeita quando o limiar de 'morno' não é menor que o de 'quente'", async () => {
    const res = await tenant.agent.patch("/crm/lead-score-config").send({ morno: 80, quente: 50 });
    expect(res.status).toBe(400);
  });

  it("com limiar de 'quente' reduzido para 50, um score de 55 já dispara a notificação de lead quente", async () => {
    await tenant.agent.patch("/crm/lead-score-config").send({ morno: 20, quente: 50 });

    const definition: FlowDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "ask", type: "question", data: { texto: "Orçamento?", variavel: "orcamento", validacao: "texto", pontuacao: 55 } },
        { id: "end", type: "end" },
      ],
      edges: [
        { id: "e1", source: "start", target: "ask" },
        { id: "e2", source: "ask", target: "end" },
      ],
    };
    const flowCreate = await tenant.agent.post("/chatbot/flows").send({ nome: `Flow Limiar ${randomUUID().slice(0, 6)}` });
    const flowId = flowCreate.body.id as string;
    await tenant.agent.patch(`/chatbot/flows/${flowId}/definition`).send(definition);
    await tenant.agent.post(`/chatbot/flows/${flowId}/publish`);
    await tenant.agent.patch(`/whatsapp/numbers/${numberId}/chatbot-flow`).send({ chatbotFlowId: flowId });

    const contatoNumero = "5511988887777";
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "Oi",
    });
    await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: contatoNumero,
      conteudo: "R$ 8000",
    });

    await waitFor(async () => {
      const list = await tenant.agent.get("/notifications");
      return list.body.find((n: { tipo: string }) => n.tipo === "contact.lead_hot") ? true : null;
    });
  }, 15_000);
});
