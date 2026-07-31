import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 30 (ver DEVELOPMENT_PLAN.md): chaves de IA da própria plataforma
 * configuráveis pelo Master, com a env var `AI_PLATFORM_*_API_KEY` como
 * fallback. Define a env var ANTES de `app.init()` (obrigatório — o
 * `ConfigService` do NestJS lê `process.env` na inicialização do módulo,
 * não a cada chamada) para poder exercitar o caminho de fallback de
 * verdade, já que este ambiente de dev não tem a variável configurada.
 */
describe("IA — chaves da plataforma (Fase 30)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  const originalEnvValue = process.env.AI_PLATFORM_GOOGLE_API_KEY;

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  beforeAll(async () => {
    process.env.AI_PLATFORM_GOOGLE_API_KEY = "env-fallback-key-1234567890";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    if (originalEnvValue === undefined) {
      delete process.env.AI_PLATFORM_GOOGLE_API_KEY;
    } else {
      process.env.AI_PLATFORM_GOOGLE_API_KEY = originalEnvValue;
    }
  });

  it("lista as chaves da plataforma distinguindo env/database/none, e o cadastro no banco tem prioridade sobre a env var", async () => {
    const before = await superAdmin.get("/master/ai/platform-keys");
    expect(before.status).toBe(200);
    const google = before.body.find((p: { provider: string }) => p.provider === "google");
    const anthropic = before.body.find((p: { provider: string }) => p.provider === "anthropic");
    expect(google).toEqual({ provider: "google", hasKey: true, source: "env" });
    expect(anthropic).toEqual({ provider: "anthropic", hasKey: false, source: "none" });

    const save = await superAdmin.patch("/master/ai/platform-keys/google").send({ apiKey: "chave-do-banco-1234567890" });
    expect(save.status).toBe(200);
    expect(save.body).toEqual({ provider: "google", saved: true });

    const after = await superAdmin.get("/master/ai/platform-keys");
    const googleAfter = after.body.find((p: { provider: string }) => p.provider === "google");
    expect(googleAfter).toEqual({ provider: "google", hasKey: true, source: "database" });

    const remove = await superAdmin.delete("/master/ai/platform-keys/google");
    expect(remove.status).toBe(200);
    expect(remove.body).toEqual({ provider: "google", deleted: true });

    const afterDelete = await superAdmin.get("/master/ai/platform-keys");
    const googleAfterDelete = afterDelete.body.find((p: { provider: string }) => p.provider === "google");
    expect(googleAfterDelete).toEqual({ provider: "google", hasKey: true, source: "env" });
  });

  it("financeiro e suporte recebem 403 ao tentar configurar chave da plataforma", async () => {
    for (const role of ["financeiro", "suporte"] as const) {
      const email = `ai-platform-${role}-${randomUUID().slice(0, 8)}@master-test.local`;
      await superAdmin.post("/master/master-users").send({
        nome: `Teste ${role}`,
        email,
        senha: "SenhaDeTeste123",
        role,
      });
      const nonAdmin = await loginMaster(email, "SenhaDeTeste123");

      const list = await nonAdmin.get("/master/ai/platform-keys");
      expect(list.status).toBe(403);

      const save = await nonAdmin.patch("/master/ai/platform-keys/anthropic").send({ apiKey: "tentativa-nao-autorizada" });
      expect(save.status).toBe(403);
    }
  });
});
