import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração do clawback de comissão de afiliado (débito
 * registrado desde a Fase 8, fechado num ciclo posterior): estorno de uma
 * fatura cuja comissão já tinha sido paga vira uma dívida do afiliado,
 * deduzida automaticamente do próximo lote de pagamento — nunca cobrada
 * ativamente. Em arquivo próprio (não dentro de `billing-affiliates.spec.ts`)
 * para não somar aos cadastros de tenant daquele arquivo e estourar o rate
 * limit de signup (`@Throttle` 5/60s em `POST /auth/tenant/signup`) — cada
 * arquivo de teste sobe sua própria instância da aplicação, com seu próprio
 * armazenamento de throttle isolado.
 */
describe("Clawback de comissão de afiliado", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;

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

  async function signupTenant(label: string, affiliateLinkCode?: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@clawback-test.local`;
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
      ...(affiliateLinkCode ? { affiliateLinkCode } : {}),
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  async function createPlan(preco: number) {
    const res = await superAdmin.post("/master/plans").send({
      nome: `Plano Teste ${randomUUID().slice(0, 8)}`,
      preco,
      recorrencia: "mensal",
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

  it("estorno de comissão já paga vira dívida, deduzida automaticamente do próximo pagamento", async () => {
    const plan = await createPlan(50);

    const createAffiliate = await superAdmin.post("/master/affiliates").send({
      nome: "Afiliado",
      sobrenome: "Clawback",
      cpf: Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(""),
      email: `afiliado-clawback-${randomUUID().slice(0, 8)}@clawback-test.local`,
    });
    const affiliateId = createAffiliate.body.id as string;
    const linkCode = createAffiliate.body.linkCode as string;
    await superAdmin.patch(`/master/affiliates/${affiliateId}/status`).send({ status: "active" });

    // Comissão fixa (não percentual) e sem planId — se aplica a qualquer plano — para manter os valores exatos e previsíveis no teste.
    await superAdmin.post(`/master/affiliates/${affiliateId}/commissions`).send({ tipo: "fixo", valor: 20 });

    const tenant = await signupTenant("aff-clawback", linkCode);

    async function subscribeAndPay() {
      const sub = await tenant.agent.post("/billing/subscribe").send({ planId: plan.id });
      const invoiceId = sub.body.invoice.id as string;
      await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });
      return invoiceId;
    }

    // 1ª conversão: paga a comissão de R$ 20 normalmente.
    const firstInvoiceId = await subscribeAndPay();
    const firstPay = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
    expect(firstPay.status).toBe(201);
    expect(Number(firstPay.body.total)).toBeCloseTo(20, 2);

    // Estorno tardio — a comissão já tinha sido paga, então vira clawback (dívida), não "reversed".
    const refund = await superAdmin
      .post(`/master/billing/tenants/${tenant.tenantId}/invoices/${firstInvoiceId}/refund`)
      .send({ motivo: "Estorno tardio para teste de clawback" });
    expect(refund.status).toBe(201);

    const clawbackReferral = await prisma.affiliateReferral.findFirst({
      where: { affiliateId, tenantId: tenant.tenantId, evento: "subscription" },
      orderBy: { createdAt: "desc" },
    });
    expect(clawbackReferral?.status).toBe("clawback");

    // 2ª conversão gera outra comissão pendente de R$ 20 — igual ao clawback, então o líquido é zero.
    await subscribeAndPay();
    const payZeroed = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
    expect(payZeroed.status).toBe(400);
    const clawbackStillOpen = await prisma.affiliateReferral.findUniqueOrThrow({ where: { id: clawbackReferral!.id } });
    expect(clawbackStillOpen.status).toBe("clawback"); // nada foi liquidado na tentativa que falhou

    // 3ª conversão soma mais R$ 20 elegível — bruto R$ 40, líquido R$ 20 após deduzir o clawback de R$ 20.
    await subscribeAndPay();
    const payNetted = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
    expect(payNetted.status).toBe(201);
    expect(payNetted.body.quantidade).toBe(2); // as duas referências pendentes (2ª e 3ª conversão)
    expect(Number(payNetted.body.total)).toBeCloseTo(20, 2); // líquido, não os R$ 40 brutos
    expect(Number(payNetted.body.clawbackDeduzido)).toBeCloseTo(20, 2);

    const clawbackAfterSettle = await prisma.affiliateReferral.findUniqueOrThrow({ where: { id: clawbackReferral!.id } });
    expect(clawbackAfterSettle.status).toBe("clawback_settled");
  }, 25_000);

  it("isolamento: outro afiliado não tem clawback afetado por estorno de tenant de outro afiliado", async () => {
    const plan = await createPlan(30);

    const createAffiliate = await superAdmin.post("/master/affiliates").send({
      nome: "Afiliado",
      sobrenome: "Isolado",
      cpf: Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(""),
      email: `afiliado-isolado-${randomUUID().slice(0, 8)}@clawback-test.local`,
    });
    const affiliateId = createAffiliate.body.id as string;
    const linkCode = createAffiliate.body.linkCode as string;
    await superAdmin.patch(`/master/affiliates/${affiliateId}/status`).send({ status: "active" });
    await superAdmin.post(`/master/affiliates/${affiliateId}/commissions`).send({ tipo: "fixo", valor: 15 });

    const tenant = await signupTenant("aff-isolado", linkCode);
    const sub = await tenant.agent.post("/billing/subscribe").send({ planId: plan.id });
    const invoiceId = sub.body.invoice.id as string;
    await tenant.agent.post(`/billing/invoices/${invoiceId}/pay`).send({ metodo: "cartao" });

    const pay = await superAdmin.post(`/master/affiliates/${affiliateId}/referrals/pay-eligible`);
    expect(pay.status).toBe(201);
    expect(pay.body.clawbackDeduzido).toBe("0.00");

    const referral = await prisma.affiliateReferral.findFirstOrThrow({
      where: { affiliateId, tenantId: tenant.tenantId, evento: "subscription" },
    });
    expect(referral.status).toBe("paid"); // nunca estornado — sem clawback pra esse afiliado
  }, 20_000);
});
