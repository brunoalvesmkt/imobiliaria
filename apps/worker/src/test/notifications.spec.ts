import { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Primeiro teste automatizado do `apps/worker` (Fase 10) — fecha a lacuna
 * registrada desde a Fase 1 ("job de fila processado pelo worker" era
 * verificado manualmente, sem suíte própria). Testa a fila "notifications"
 * de ponta a ponta contra Redis/Postgres reais: enfileira na fila real,
 * deixa o `NotificationsProcessor` (rodando dentro deste mesmo processo de
 * teste, como um worker de verdade) consumir, e verifica o resultado
 * persistido em `EmailLog`/`AuditLog`.
 */
describe("Notifications (worker) — Fase 10", () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let queue: Queue;
  let tenantId: string;

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 200): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error("Timeout esperando condição.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    queue = app.get<Queue>(getQueueToken("notifications"));

    const suffix = randomUUID().slice(0, 8);
    const tenant = await prisma.tenant.create({
      data: {
        razaoSocial: `Empresa Worker Teste ${suffix}`,
        cnpj: Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join(""),
        responsavel: "Responsavel Teste",
        email: `worker-${suffix}@worker-test.local`,
        subdominio: `worker-teste-${suffix}`,
      },
    });
    tenantId = tenant.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("processa um job de boas-vindas real: envia (simulado) e registra EmailLog + AuditLog", async () => {
    const tenantUserId = randomUUID();
    const email = `bemvindo-${randomUUID().slice(0, 8)}@worker-test.local`;

    await queue.add("tenant_user.welcome", { tenantId, tenantUserId, email });

    const emailLog = await waitFor(() => prisma.emailLog.findFirst({ where: { tenantId, to: email, template: "welcome" } }));
    expect(emailLog.provider).toBe("log");
    expect(emailLog.status).toBe("sent");
    expect(emailLog.providerRef).toBeTruthy();

    const auditLog = await waitFor(() =>
      prisma.auditLog.findFirst({ where: { tenantId, actorId: tenantUserId, action: "notification.welcome_sent" } }),
    );
    expect(auditLog.entity).toBe("TenantUser");
  }, 15_000);

  it("processa um job de recuperação de senha real: o corpo do e-mail contém o token", async () => {
    const tenantUserId = randomUUID();
    const email = `reset-${randomUUID().slice(0, 8)}@worker-test.local`;
    const rawToken = randomUUID();

    await queue.add("tenant_user.password_reset", { tenantId, tenantUserId, email, rawToken });

    const emailLog = await waitFor(() => prisma.emailLog.findFirst({ where: { tenantId, to: email, template: "password_reset" } }));
    expect(emailLog.assunto).toBe("Recuperação de senha");

    const auditLog = await waitFor(() =>
      prisma.auditLog.findFirst({ where: { tenantId, actorId: tenantUserId, action: "notification.password_reset_sent" } }),
    );
    expect(auditLog).not.toBeNull();
  }, 15_000);

  it("job com nome desconhecido não gera EmailLog nem quebra o worker", async () => {
    const email = `desconhecido-${randomUUID().slice(0, 8)}@worker-test.local`;
    await queue.add("evento.inexistente", { tenantId, tenantUserId: randomUUID(), email });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const emailLog = await prisma.emailLog.findFirst({ where: { to: email } });
    expect(emailLog).toBeNull();
  });
});
