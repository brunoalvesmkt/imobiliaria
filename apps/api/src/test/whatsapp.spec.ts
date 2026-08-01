import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID, createHmac } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração do módulo WhatsApp (Fase 4): abstração de
 * provedores (conexão não oficial simulada + webhook real da Meta),
 * aceite de risco obrigatório, conversas/mensagens e — o caso mais
 * importante — idempotência de webhook duplicado (ACCEPTANCE_CRITERIA.md,
 * caso crítico #6).
 */
describe("WhatsApp (Fase 4)", () => {
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
    if (res.status !== 200) {
      throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@whatsapp-test.local`;
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
    if (res.status !== 201) {
      throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
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
    if (!seedEmail || !seedPassword) {
      throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    }
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("wpp");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("bloqueia /whatsapp/numbers quando o módulo não está ativo para outro tenant", async () => {
    const other = await signupTenant("wpp-noaccess");
    const res = await other.agent.get("/whatsapp/numbers");
    expect(res.status).toBe(403);
  });

  it("conecta um número não oficial via provedor simulado (QR fake + confirmação)", async () => {
    const create = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("disconnected");
    expect(create.body.provider).toBe("fake_unofficial");

    const connect = await tenant.agent.post(`/whatsapp/numbers/${create.body.id}/connect`);
    expect(connect.status).toBe(201);
    expect(connect.body.status).toBe("authenticating");
    // Fase 48: o QR cru do provedor agora é renderizado como imagem PNG (data URI) pelo NumbersService, não devolvido como texto.
    expect(connect.body.qrCode).toMatch(/^data:image\/png;base64,/);

    const confirm = await tenant.agent.post(`/whatsapp/numbers/${create.body.id}/confirm-connection`);
    expect(confirm.status).toBe(201);
    expect(confirm.body.status).toBe("connected");

    const detail = await tenant.agent.get(`/whatsapp/numbers/${create.body.id}`);
    expect(detail.body.status).toBe("connected");
  });

  it("bloqueia envio em número não oficial sem aceite de risco, libera após aceitar", async () => {
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55118${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    const numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511977776666",
      conteudo: "Oi, quero saber mais",
    });
    expect(incoming.status).toBe(201);
    const conversationId = incoming.body.conversationId as string;

    const blockedSend = await tenant.agent
      .post(`/whatsapp/conversations/${conversationId}/messages`)
      .send({ tipo: "text", texto: "Olá! Como posso ajudar?" });
    expect(blockedSend.status).toBe(403);

    // Item 14.3: a versão do termo é definida pelo servidor (Master),
    // não mais enviada pelo cliente — ver PlatformSettings.riskTermVersion.
    const acceptRisk = await tenant.agent.post(`/whatsapp/numbers/${numberId}/accept-risk`).send({});
    expect(acceptRisk.status).toBe(201);

    const allowedSend = await tenant.agent
      .post(`/whatsapp/conversations/${conversationId}/messages`)
      .send({ tipo: "text", texto: "Olá! Como posso ajudar?" });
    expect(allowedSend.status).toBe(201);
    expect(allowedSend.body.direction).toBe("out");
    expect(allowedSend.body.senderType).toBe("agent");
  });

  it("webhook oficial da Meta: handshake de verificação", async () => {
    const res = await request(app.getHttpServer())
      .get("/whatsapp/webhooks/meta")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "dev-verify-token", "hub.challenge": "challenge-123" });
    expect(res.status).toBe(200);
    expect(res.text).toBe("challenge-123");
  });

  it("webhook oficial da Meta: rejeita assinatura inválida", async () => {
    const payload = JSON.stringify({ entry: [] });
    const res = await request(app.getHttpServer())
      .post("/whatsapp/webhooks/meta")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", "sha256=assinatura-invalida")
      .send(payload);
    expect(res.status).toBe(401);
  });

  it("webhook oficial da Meta: recebe mensagem real e é idempotente contra reentrega duplicada (caso crítico #6)", async () => {
    const externalAccountId = `phone-id-${randomUUID().slice(0, 8)}`;
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "chatbot",
      modalidade: "official_api",
      numero: `55117${Math.floor(Math.random() * 90000000 + 10000000)}`,
      externalAccountId,
    });
    expect(numberRes.status).toBe(201);

    const messageId = `wamid.${randomUUID()}`;
    const payloadObj = {
      entry: [
        {
          id: "WABA_TEST",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: externalAccountId },
                messages: [
                  {
                    from: "5511966665555",
                    id: messageId,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "Mensagem real via webhook" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const rawBody = JSON.stringify(payloadObj);
    const signature = "sha256=" + createHmac("sha256", "dev-app-secret-for-hmac-testing-only").update(rawBody).digest("hex");

    const first = await request(app.getHttpServer())
      .post("/whatsapp/webhooks/meta")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signature)
      .send(rawBody);
    expect(first.status).toBe(200);

    // Reentrega idêntica do mesmo webhook (comportamento real da Meta em falhas de rede).
    const second = await request(app.getHttpServer())
      .post("/whatsapp/webhooks/meta")
      .set("Content-Type", "application/json")
      .set("x-hub-signature-256", signature)
      .send(rawBody);
    expect(second.status).toBe(200);

    const messages = await prisma.message.findMany({ where: { externalId: messageId } });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.conteudo).toBe("Mensagem real via webhook");

    const conversations = await prisma.conversation.findMany({
      where: { tenantId: tenant.tenantId, contatoNumero: "5511966665555" },
    });
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.unreadCount).toBe(1); // não incrementou duas vezes
  });

  it("templates: ciclo de vida draft -> pending -> approved, e bloqueia edição fora de draft", async () => {
    const create = await tenant.agent.post("/whatsapp/templates").send({
      nome: `boas_vindas_${randomUUID().slice(0, 6)}`,
      categoria: "utility",
      corpo: "Olá {{1}}, bem-vindo!",
    });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe("draft");

    const submit = await tenant.agent.post(`/whatsapp/templates/${create.body.id}/submit`);
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe("pending");

    const editAfterSubmit = await tenant.agent
      .patch(`/whatsapp/templates/${create.body.id}`)
      .send({ corpo: "Tentativa de editar" });
    expect(editAfterSubmit.status).toBe(400);

    const approve = await tenant.agent.post(`/whatsapp/templates/${create.body.id}/approve`);
    expect(approve.status).toBe(201);
    expect(approve.body.status).toBe("approved");
  });

  it("isolamento: outro tenant não vê conversas nem números deste tenant", async () => {
    const other = await signupTenant("wpp-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "whatsapp", enabled: true });

    const numbers = await other.agent.get("/whatsapp/numbers");
    expect(numbers.status).toBe(200);
    expect(numbers.body).toHaveLength(0);

    const conversations = await other.agent.get("/whatsapp/conversations");
    expect(conversations.status).toBe(200);
    expect(conversations.body).toHaveLength(0);
  });
});
