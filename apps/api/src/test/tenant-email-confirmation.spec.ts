import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Troca do e-mail da empresa (Tenant.email) com confirmação por código
 * (documento de alterações, item 6.1.7.3) — ver tenants.service.ts. Só
 * cobre o caminho padrão (`EMAIL_CONFIRMATION_REQUIRED` não setado no
 * .env de teste, então o default `true` vale).
 */
describe("Confirmação de e-mail da empresa por código", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsQueue: Queue;

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

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@email-confirm-test.local`;
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
    return { agent, tenantId: me.body.tenantId as string };
  }

  async function waitForCode(email: string): Promise<string> {
    const deadline = Date.now() + 8000;
    for (;;) {
      const jobs = await notificationsQueue.getJobs(["waiting", "active", "completed", "delayed"]);
      const job = jobs.find((j) => j.name === "tenant.email_confirmation_code" && (j.data as { email: string }).email === email);
      if (job) return (job.data as { codigo: string }).codigo;
      if (Date.now() > deadline) throw new Error("Timeout esperando job de confirmação de e-mail na fila.");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    notificationsQueue = app.get<Queue>(getQueueToken("notifications"));
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("fica pendente até confirmar o código — não muda o e-mail atual antes disso", async () => {
    const tenant = await signupTenant("email-confirm");
    const novoEmail = `novo-${randomUUID().slice(0, 8)}@email-confirm-test.local`;

    const request1 = await tenant.agent.post("/tenants/me/email/request-change").send({ novoEmail });
    expect(request1.status).toBe(200);
    expect(request1.body.requiresConfirmation).toBe(true);

    const pending = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.tenantId } });
    expect(pending.email).not.toBe(novoEmail);
    expect(pending.emailPendente).toBe(novoEmail);
    expect(pending.emailConfirmado).toBe(false);

    const codigo = await waitForCode(novoEmail);
    expect(codigo).toMatch(/^\d{6}$/);

    const wrongCode = await tenant.agent.post("/tenants/me/email/confirm").send({ codigo: "000000" });
    expect(wrongCode.status).toBe(400);

    const confirm = await tenant.agent.post("/tenants/me/email/confirm").send({ codigo });
    expect(confirm.status).toBe(200);

    const confirmed = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.tenantId } });
    expect(confirmed.email).toBe(novoEmail);
    expect(confirmed.emailPendente).toBeNull();
    expect(confirmed.emailConfirmado).toBe(true);
  }, 15_000);

  it("confirmar sem troca pendente falha", async () => {
    const tenant = await signupTenant("email-confirm-none");
    const res = await tenant.agent.post("/tenants/me/email/confirm").send({ codigo: "123456" });
    expect(res.status).toBe(400);
  });
});
