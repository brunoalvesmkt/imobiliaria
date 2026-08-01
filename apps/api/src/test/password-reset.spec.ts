import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";

/**
 * Testes de recuperação de senha (Fase 10) — antes desta fase, o endpoint
 * gerava o token e o descartava (TODO explícito em auth.service.ts),
 * tornando o fluxo inutilizável de ponta a ponta. Agora ele enfileira de
 * verdade na fila "notifications" (mesma fila processada pelo
 * `apps/worker`, ver notifications.spec.ts lá). Como este teste roda só a
 * API (o worker é um processo separado), o token é obtido inspecionando o
 * job real enfileirado no Redis — não há outra forma de obtê-lo, já que só
 * o hash fica no banco.
 */
describe("Recuperação de senha (Fase 10)", () => {
  let app: INestApplication;
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
    const email = `${label}-${suffix}@password-reset-test.local`;
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
    return { agent, email, senha };
  }

  async function waitForJob(email: string): Promise<{ rawToken: string }> {
    const deadline = Date.now() + 8000;
    for (;;) {
      const jobs = await notificationsQueue.getJobs(["waiting", "active", "completed", "delayed"]);
      const job = jobs.find((j) => j.name === "tenant_user.password_reset" && (j.data as { email: string }).email === email);
      if (job) return job.data as { rawToken: string };
      if (Date.now() > deadline) throw new Error("Timeout esperando job de recuperação de senha na fila.");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    notificationsQueue = app.get<Queue>(getQueueToken("notifications"));
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("enfileira de verdade o e-mail de recuperação e permite redefinir a senha com o token", async () => {
    const { email, senha } = await signupTenant("reset");

    const requestReset = await request(app.getHttpServer()).post("/auth/tenant/password-reset/request").send({ email });
    expect(requestReset.status).toBe(200);

    const { rawToken } = await waitForJob(email);
    expect(rawToken).toBeTruthy();

    const novaSenha = "NovaSenhaForte456";
    const confirm = await request(app.getHttpServer()).post("/auth/tenant/password-reset/confirm").send({ token: rawToken, novaSenha });
    expect(confirm.status).toBe(200);

    const loginComSenhaAntiga = await request(app.getHttpServer()).post("/auth/tenant/login").send({ email, senha });
    expect(loginComSenhaAntiga.status).toBe(401);

    const loginComSenhaNova = await request(app.getHttpServer()).post("/auth/tenant/login").send({ email, senha: novaSenha });
    expect(loginComSenhaNova.status).toBe(200);
  }, 15_000);

  it("e-mail inexistente responde 200 (sem revelar se a conta existe) e não enfileira nada", async () => {
    const ghostEmail = `fantasma-${randomUUID().slice(0, 8)}@password-reset-test.local`;
    const res = await request(app.getHttpServer()).post("/auth/tenant/password-reset/request").send({ email: ghostEmail });
    expect(res.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 500));
    const jobs = await notificationsQueue.getJobs(["waiting", "active", "completed", "delayed"]);
    const found = jobs.find((j) => (j.data as { email?: string }).email === ghostEmail);
    expect(found).toBeUndefined();
  });
});
