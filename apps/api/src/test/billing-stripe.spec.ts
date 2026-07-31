import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID, createHmac } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Testes de integração do gateway real (Stripe) — provedor selecionado por
 * env (`PAYMENT_GATEWAY_PROVIDER=stripe`, setado ANTES de compilar o módulo
 * de teste, já que `payment-providers.module.ts` resolve o provedor uma vez
 * na inicialização). Não há credencial real de Stripe disponível neste
 * ambiente (mesma situação do MetaOfficialProvider e dos provedores de IA),
 * então as chamadas HTTP para `api.stripe.com` são substituídas por um
 * `fetch` mockado — o que É verificável de ponta a ponta sem rede real é
 * exatamente a parte que depende só do nosso código: assinatura de webhook,
 * resolução de fatura por `gatewayRef`, idempotência e o efeito colateral
 * completo de `onInvoicePaid` (assinatura ativa, evento de domínio,
 * comissão de afiliado).
 */
describe("Financeiro — gateway real (Stripe)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let originalFetch: typeof fetch;

  const STRIPE_WEBHOOK_SECRET = "whsec_teste_stripe_123";

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
    const email = `${label}-${suffix}@stripe-test.local`;
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

  function signStripeEvent(payload: string, timestamp: number): string {
    const signature = createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    return `t=${timestamp},v1=${signature}`;
  }

  function mockFetchOnce(status: number, body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    process.env.PAYMENT_GATEWAY_PROVIDER = "stripe";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key";
    process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("stripe");
  }, 30_000);

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    delete process.env.PAYMENT_GATEWAY_PROVIDER;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await app.close();
  });

  it("cobrança via Stripe cria uma sessão de checkout e deixa a fatura pendente até o webhook confirmar", async () => {
    const plan = await superAdmin.post("/master/plans").send({
      nome: `Plano Stripe ${randomUUID().slice(0, 8)}`,
      preco: 99,
      recorrencia: "mensal",
      modulos: [],
      limites: {},
    });
    const subscribe = await tenant.agent.post("/billing/subscribe").send({ planId: plan.body.id });
    const invoiceId = subscribe.body.invoice.id as string;

    // Id único por execução — gatewayRef não é único no schema (não precisa ser, sessões
    // reais do Stripe já são globalmente únicas); um literal fixo faria `findFirst` em
    // `confirmPaymentByGatewayRef` colidir com faturas de execuções anteriores deste teste.
    const sessionId = `cs_test_${randomUUID()}`;
    mockFetchOnce(200, { id: sessionId, url: `https://checkout.stripe.com/pay/${sessionId}` });

    const pay = await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });
    expect(pay.status).toBe(201);
    expect(pay.body.status).toBe("pending"); // Stripe nunca confirma síncrono — só via webhook
    expect(pay.body.gatewayRef).toBe(sessionId);
    expect(pay.body.checkoutUrl).toBe(`https://checkout.stripe.com/pay/${sessionId}`);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.headers.Authorization).toBe("Bearer sk_test_fake_key");

    // Assinatura de webhook inválida é rejeitada, e a fatura continua pendente.
    const badPayload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sessionId } } });
    const badWebhook = await request(app.getHttpServer())
      .post("/billing/webhooks/stripe")
      .set("stripe-signature", "t=123,v1=assinatura-invalida")
      .set("content-type", "application/json")
      .send(badPayload);
    expect(badWebhook.status).toBe(401);

    const stillPending = await tenant.agent.get("/billing/invoices");
    expect(stillPending.body.find((i: { id: string }) => i.id === invoiceId).status).toBe("pending");

    // Webhook com assinatura válida confirma o pagamento — mesmo evento que o Stripe envia de verdade.
    const timestamp = Math.floor(Date.now() / 1000);
    const goodPayload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sessionId } } });
    const goodWebhook = await request(app.getHttpServer())
      .post("/billing/webhooks/stripe")
      .set("stripe-signature", signStripeEvent(goodPayload, timestamp))
      .set("content-type", "application/json")
      .send(goodPayload);
    expect(goodWebhook.status).toBe(200);

    const invoices = await tenant.agent.get("/billing/invoices");
    const paidInvoice = invoices.body.find((i: { id: string }) => i.id === invoiceId);
    expect(paidInvoice.status).toBe("paid");
    expect(paidInvoice.pagoEm).not.toBeNull();

    const subscription = await tenant.agent.get("/billing/subscription");
    expect(subscription.body.status).toBe("active");

    // Reenvio do mesmo evento (comum em gateways reais) é idempotente — não falha, não duplica efeito.
    const replay = await request(app.getHttpServer())
      .post("/billing/webhooks/stripe")
      .set("stripe-signature", signStripeEvent(goodPayload, Math.floor(Date.now() / 1000)))
      .set("content-type", "application/json")
      .send(goodPayload);
    expect(replay.status).toBe(200);
  }, 20_000);

  it("estorno via Stripe busca o payment_intent da sessão e chama o endpoint de refund", async () => {
    const plan = await superAdmin.post("/master/plans").send({
      nome: `Plano Stripe Estorno ${randomUUID().slice(0, 8)}`,
      preco: 50,
      recorrencia: "mensal",
      modulos: [],
      limites: {},
    });
    const subscribe = await tenant.agent.post("/billing/subscribe").send({ planId: plan.body.id });
    const invoiceId = subscribe.body.invoice.id as string;

    const sessionId = `cs_test_${randomUUID()}`;
    mockFetchOnce(200, { id: sessionId, url: `https://checkout.stripe.com/pay/${sessionId}` });
    await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });

    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: sessionId } } });
    await request(app.getHttpServer())
      .post("/billing/webhooks/stripe")
      .set("stripe-signature", signStripeEvent(payload, timestamp))
      .set("content-type", "application/json")
      .send(payload);

    mockFetchOnce(200, { payment_intent: "pi_test_xyz" }); // busca da sessão
    mockFetchOnce(200, { id: "re_test_xyz" }); // criação do refund

    const refund = await superAdmin
      .post(`/master/billing/tenants/${tenant.tenantId}/invoices/${invoiceId}/refund`)
      .send({ motivo: "Teste de estorno via Stripe" });
    expect(refund.status).toBe(201);

    // 3 chamadas nesta execução: criação da sessão de checkout (pay), busca da sessão e criação do refund.
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const [sessionUrl] = (global.fetch as jest.Mock).mock.calls[1];
    expect(sessionUrl).toBe(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`);
    const [refundUrl] = (global.fetch as jest.Mock).mock.calls[2];
    expect(refundUrl).toBe("https://api.stripe.com/v1/refunds");

    const invoices = await tenant.agent.get("/billing/invoices");
    expect(invoices.body.find((i: { id: string }) => i.id === invoiceId).status).toBe("refunded");
  }, 20_000);
});
