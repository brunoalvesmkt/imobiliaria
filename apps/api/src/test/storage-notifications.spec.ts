import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

/**
 * Notificação de limite de armazenamento — dispara só quando o consumo
 * CRUZA uma faixa (80/90/100%) ainda não notificada (`lastNotifiedTier`),
 * nunca reenvia a cada upload dentro da mesma faixa, e volta a poder
 * notificar se o consumo cair abaixo de 80% depois de uma exclusão.
 *
 * `StorageService.recordFileAdded`/`recalculate` recebem `tenantId`
 * explícito (não dependem do AsyncLocalStorage de contexto de requisição),
 * por isso são chamados diretamente aqui via injeção do serviço — sem
 * precisar simular upload real no S3/MinIO.
 */
describe("Armazenamento — notificação de limite por faixa", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

  const ONE_MB = 1024 * 1024;

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
    const email = `${label}-${suffix}@storage-notif-test.local`;
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

  async function notificationCount(tipo: string): Promise<number> {
    return prisma.notification.count({ where: { tenantId: tenant.tenantId, tipo } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("storagenotif");

    // Limite pequeno e previsível (10 MB) — fácil cruzar 80/90/100% com poucos MB.
    const limitRes = await superAdmin.patch(`/master/tenants/${tenant.tenantId}/storage-limit`).send({
      storageLimitMb: 10,
      storageUnlimited: false,
    });
    expect(limitRes.status).toBe(200);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("dispara a notificação só uma vez ao cruzar 80%, não refire dentro da mesma faixa, dispara de novo ao cruzar 90% e 100%", async () => {
    expect(await notificationCount("storage.limit_reached")).toBe(0);

    // 79% — abaixo do primeiro limite, não dispara.
    await storage.recordFileAdded(tenant.tenantId, Math.round(7.9 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(0);

    // Cruza 80% — dispara uma vez.
    await storage.recordFileAdded(tenant.tenantId, Math.round(0.2 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(1);

    // Mais um upload pequeno, ainda dentro da faixa 80-89% — não reenvia.
    await storage.recordFileAdded(tenant.tenantId, Math.round(0.3 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(1);

    // Cruza 90% — dispara de novo (faixa nova).
    await storage.recordFileAdded(tenant.tenantId, Math.round(0.6 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(2);

    // Cruza 100% — dispara de novo.
    await storage.recordFileAdded(tenant.tenantId, Math.round(1 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(3);

    // Mais upload acima de 100% — já notificou a maior faixa, não reenvia.
    await storage.recordFileAdded(tenant.tenantId, Math.round(0.5 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(3);

    const usage = await prisma.tenantStorageUsage.findUnique({ where: { tenantId: tenant.tenantId } });
    expect(usage?.lastNotifiedTier).toBe(100);
  });

  it("reseta lastNotifiedTier quando o consumo cai abaixo de 80% após exclusão, permitindo notificar de novo", async () => {
    const usageBefore = await prisma.tenantStorageUsage.findUnique({ where: { tenantId: tenant.tenantId } });
    expect(usageBefore?.lastNotifiedTier).toBe(100);
    const totalBefore = Number(usageBefore!.totalBytes);

    // Remove a maior parte do consumo — cai para bem abaixo de 80%.
    await storage.recordFileRemoved(tenant.tenantId, totalBefore - Math.round(1 * ONE_MB), "image/png");

    const usageAfter = await prisma.tenantStorageUsage.findUnique({ where: { tenantId: tenant.tenantId } });
    expect(usageAfter?.lastNotifiedTier).toBe(0);

    const countBeforeRecross = await notificationCount("storage.limit_reached");

    // Cruza 80% de novo — volta a notificar.
    await storage.recordFileAdded(tenant.tenantId, Math.round(8.5 * ONE_MB), "image/png");
    expect(await notificationCount("storage.limit_reached")).toBe(countBeforeRecross + 1);
  });

  it("recordFileRemoved nunca deixa o contador negativo (clamp em 0)", async () => {
    const tenantId = tenant.tenantId;
    await storage.recordFileRemoved(tenantId, 999 * ONE_MB, "application/pdf");
    const usage = await prisma.tenantStorageUsage.findUnique({ where: { tenantId } });
    expect(Number(usage?.totalBytes)).toBeGreaterThanOrEqual(0);
    expect(Number(usage?.documentosBytes)).toBeGreaterThanOrEqual(0);
  });
});
