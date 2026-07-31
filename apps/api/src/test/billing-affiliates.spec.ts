import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração do Financeiro e Afiliados (Fase 8): contratação de
 * plano, pagamento via gateway simulado (cartão confirma na hora, boleto
 * fica pendente), cobrança manual, estorno com reversão de comissão,
 * isolamento entre tenants, rastreio de afiliado até a conversão em
 * assinatura paga, cálculo/pagamento de comissão e o job de renovação
 * (geração de fatura de renovação + marcação de fatura vencida como
 * overdue) — sempre contra Postgres/Redis reais.
 */
describe("Financeiro e Afiliados (Fase 8)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string, affiliateLinkCode?: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@billing-test.local`;
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
      ...(affiliateLinkCode ? { affiliateLinkCode } : {}),
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  async function createPlan(preco: number, recorrencia: "mensal" | "anual" = "mensal") {
    const res = await superAdmin.post("/master/plans").send({
      nome: `Plano Teste ${randomUUID().slice(0, 8)}`,
      preco,
      recorrencia,
      modulos: [],
      limites: {},
    });
    if (res.status !== 201) throw new Error(`Criação de plano falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body as { id: string; preco: string };
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
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe("Contratação, cobrança manual, estorno e isolamento", () => {
    it("contrata um plano (waiting + fatura pendente), boleto fica pendente, cobrança manual ativa, estorno cancela", async () => {
      const tenant = await signupTenant("billing-main");
      const plan = await createPlan(199.9);

      const subscribeRes = await tenant.agent.post("/billing/subscribe").send({ planId: plan.id });
      expect(subscribeRes.status).toBe(201);
      expect(subscribeRes.body.subscription.status).toBe("waiting");
      expect(subscribeRes.body.invoice.status).toBe("pending");
      const invoiceId = subscribeRes.body.invoice.id as string;

      const payBoleto = await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "boleto" });
      expect(payBoleto.status).toBe(201);
      expect(payBoleto.body.status).toBe("pending"); // boleto aguarda compensação, não confirma na hora
      expect(payBoleto.body.gatewayRef).toBeTruthy();

      const subAfterBoleto = await tenant.agent.get("/billing/subscription");
      expect(subAfterBoleto.body.status).toBe("waiting"); // ainda não foi confirmado

      const markPaid = await superAdmin.post(`/master/billing/tenants/${tenant.tenantId}/invoices/${invoiceId}/mark-paid`);
      expect(markPaid.status).toBe(201);
      expect(markPaid.body.status).toBe("paid");
      expect(markPaid.body.metodo).toBe("manual");

      const subAfterManual = await tenant.agent.get("/billing/subscription");
      expect(subAfterManual.body.status).toBe("active");
      expect(subAfterManual.body.plan.id).toBe(plan.id);

      const invoices = await tenant.agent.get("/billing/invoices");
      expect(invoices.body).toHaveLength(1);
      expect(invoices.body[0].status).toBe("paid");

      const refund = await superAdmin
        .post(`/master/billing/tenants/${tenant.tenantId}/invoices/${invoiceId}/refund`)
        .send({ motivo: "Cliente desistiu" });
      expect(refund.status).toBe(201);
      expect(refund.body.status).toBe("refunded");

      const subAfterRefund = await tenant.agent.get("/billing/subscription");
      expect(subAfterRefund.body.status).toBeUndefined(); // refunded não entra em waiting/active/overdue/delinquent (getCurrentSubscription não encontra nada)
      const subscriptionRowAfterRefund = await prisma.subscription.findFirstOrThrow({ where: { tenantId: tenant.tenantId } });
      expect(subscriptionRowAfterRefund.status).toBe("refunded");

      const other = await signupTenant("billing-other");
      const otherInvoices = await other.agent.get("/billing/invoices");
      expect(otherInvoices.body).toHaveLength(0); // isolamento: não vê faturas do outro tenant
    }, 20_000);

    it("cancelamento self-service: assinatura paga vira cancelled e fatura pendente é cancelada junto, sem estorno", async () => {
      const tenant = await signupTenant("billing-cancel");
      const plan = await createPlan(99.9, "mensal");

      const subscribeRes = await tenant.agent.post("/billing/subscribe").send({ planId: plan.id });
      const invoiceId = subscribeRes.body.invoice.id as string;
      await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });

      const active = await tenant.agent.get("/billing/subscription");
      expect(active.body.status).toBe("active");

      // Fatura da próxima renovação, ainda pendente, deve ser cancelada junto.
      await prisma.invoice.create({
        data: {
          tenantId: tenant.tenantId,
          subscriptionId: active.body.id,
          valor: plan.preco,
          status: "pending",
          vencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const cancel = await tenant.agent.post("/billing/cancel");
      expect(cancel.status).toBe(201);
      expect(cancel.body.status).toBe("cancelled");

      const afterCancel = await tenant.agent.get("/billing/subscription");
      expect(afterCancel.body.status).toBeUndefined(); // cancelled não entra em waiting/active/overdue/delinquent

      const invoices = await tenant.agent.get("/billing/invoices");
      const statuses = invoices.body.map((i: { status: string }) => i.status).sort();
      expect(statuses).toEqual(["cancelled", "paid"]); // a paga continua paga, a pendente foi cancelada

      const secondCancel = await tenant.agent.post("/billing/cancel");
      expect(secondCancel.status).toBe(404); // já não há assinatura ativa para cancelar
    });

    it("GET /billing/plans devolve só planos ativos, para a tela de contratação do tenant", async () => {
      const tenant = await signupTenant("billing-plans");
      const activePlan = await createPlan(49.9);
      const inactivePlan = await createPlan(999);
      const deactivate = await superAdmin.patch(`/master/plans/${inactivePlan.id}`).send({ ativo: false });
      expect(deactivate.status).toBe(200);

      const plans = await tenant.agent.get("/billing/plans");
      expect(plans.status).toBe(200);
      const ids = (plans.body as { id: string }[]).map((p) => p.id);
      expect(ids).toContain(activePlan.id);
      expect(ids).not.toContain(inactivePlan.id);
    }, 20_000);
  });

  describe("Afiliados: rastreio, comissão e renovação", () => {
    it("clique + cadastro + assinatura paga geram e pagam comissão; renovação gera nova fatura; fatura vencida vira overdue", async () => {
      const plan = await createPlan(100);

      const createAffiliate = await superAdmin.post("/master/affiliates").send({
        nome: "Afiliado",
        sobrenome: "Teste",
        cpf: Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(""),
        email: `afiliado-${randomUUID().slice(0, 8)}@billing-test.local`,
      });
      expect(createAffiliate.status).toBe(201);
      const affiliateId = createAffiliate.body.id as string;
      const linkCode = createAffiliate.body.linkCode as string;

      await superAdmin.patch(`/master/affiliates/${affiliateId}/status`).send({ status: "active" });

      const commission = await superAdmin.post(`/master/affiliates/${affiliateId}/commissions`).send({
        tipo: "percentual",
        valor: 10,
        recorrente: true,
        planId: plan.id,
      });
      expect(commission.status).toBe(201);

      const click = await request(app.getHttpServer()).post(`/public/affiliates/${linkCode}/click`);
      expect(click.status).toBe(200);
      expect(click.body.trackingId).toBeTruthy();

      const invalidClick = await request(app.getHttpServer()).post(`/public/affiliates/codigo-invalido-xyz/click`);
      expect(invalidClick.status).toBe(404);

      const tenant = await signupTenant("aff-tenant", linkCode);

      const signupReferral = await prisma.affiliateReferral.findFirst({ where: { tenantId: tenant.tenantId, evento: "signup" } });
      expect(signupReferral).not.toBeNull();
      expect(signupReferral?.affiliateId).toBe(affiliateId);

      const subscribeRes = await tenant.agent.post("/billing/subscribe").send({ planId: plan.id });
      const invoiceId = subscribeRes.body.invoice.id as string;

      const pay = await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });
      expect(pay.status).toBe(201);
      expect(pay.body.status).toBe("paid"); // cartão confirma na hora no simulador

      const subAfterPay = await tenant.agent.get("/billing/subscription");
      expect(subAfterPay.body.status).toBe("active");

      const commissionReferral = await prisma.affiliateReferral.findFirst({
        where: { tenantId: tenant.tenantId, evento: "subscription" },
      });
      expect(commissionReferral).not.toBeNull();
      expect(commissionReferral?.status).toBe("pending");
      expect(Number(commissionReferral?.valorComissao)).toBeCloseTo(10, 5); // 10% de R$ 100

      const payEligible = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
      expect(payEligible.status).toBe(201);
      expect(payEligible.body.quantidade).toBe(1);
      expect(Number(payEligible.body.total)).toBeCloseTo(10, 2);

      const payEligibleAgain = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
      expect(payEligibleAgain.status).toBe(400); // nada mais elegível

      // Força a assinatura a já estar "vencida" para o ciclo de renovação mensal.
      const subscriptionRow = await prisma.subscription.findFirstOrThrow({ where: { tenantId: tenant.tenantId, status: "active" } });
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      await prisma.subscription.update({ where: { id: subscriptionRow.id }, data: { renewedAt: twoMonthsAgo } });

      const renewalCheck1 = await superAdmin.post("/master/billing/run-renewal-check");
      expect(renewalCheck1.status).toBe(201);
      expect(renewalCheck1.body.renewalsGenerated).toBeGreaterThanOrEqual(1);

      const renewalInvoice = await prisma.invoice.findFirstOrThrow({
        where: { subscriptionId: subscriptionRow.id, status: "pending" },
        orderBy: { createdAt: "desc" },
      });

      // Força a nova fatura a já estar vencida e roda a checagem de novo.
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.invoice.update({ where: { id: renewalInvoice.id }, data: { vencimento: yesterday } });

      const renewalCheck2 = await superAdmin.post("/master/billing/run-renewal-check");
      expect(renewalCheck2.status).toBe(201);
      expect(renewalCheck2.body.overdue).toBeGreaterThanOrEqual(1);

      const overdueInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: renewalInvoice.id } });
      expect(overdueInvoice.status).toBe("overdue");

      const overdueSubscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionRow.id } });
      expect(overdueSubscription.status).toBe("overdue");
    }, 25_000);
  });

  describe("Autorização do painel Master", () => {
    it("bloqueia /master/affiliates e /master/billing sem autenticação Master", async () => {
      const noAuth = request(app.getHttpServer());
      const affiliatesRes = await noAuth.get("/master/affiliates");
      expect(affiliatesRes.status).toBe(401);

      const billingRes = await noAuth.post("/master/billing/run-renewal-check");
      expect(billingRes.status).toBe(401);
    });
  });
});
