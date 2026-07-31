import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { AuthService } from "../auth/auth.service";
import { MasterAuthService } from "../auth/master-auth.service";

/**
 * Testes do bloqueio progressivo por conta (Fase 10 — fecha o débito
 * técnico registrado na Fase 1: "hoje o rate limit é só por IP/rota").
 *
 * As tentativas falhas são feitas chamando `AuthService`/`MasterAuthService`
 * diretamente (sem passar pela camada HTTP) — a rota de login já tem seu
 * próprio `@Throttle({ limit: 5, ttl: 60_000 })` por IP/rota, que bloquearia
 * a 6ª chamada HTTP antes mesmo de chegar à lógica de bloqueio por conta que
 * queremos testar aqui (são duas defesas independentes e complementares —
 * ver account-lockout.util.ts). Só a chamada final, que confirma que o 423
 * realmente atravessa o controller de verdade, usa HTTP.
 *
 * Nunca usa o MasterUser semeado (`MASTER_SEED_EMAIL`) nas tentativas
 * falhas — bloqueá-lo quebraria todos os outros arquivos de teste que
 * dependem dele para autenticar como Master (mesmo banco real, estado
 * persiste entre arquivos). Um MasterUser descartável é criado
 * especificamente para isso.
 */
describe("Bloqueio progressivo por conta (Fase 10)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let masterAuthService: MasterAuthService;
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

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@lockout-test.local`;
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
    return { email, senha };
  }

  async function expectUnauthorized(promise: Promise<unknown>) {
    await expect(promise).rejects.toMatchObject({ status: 401 });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    authService = app.get(AuthService);
    masterAuthService = app.get(MasterAuthService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("tenant: bloqueia a conta após 5 tentativas falhas seguidas, mesmo com a senha correta na 6ª tentativa", async () => {
    const { email, senha } = await signupTenant("lockout-tenant");

    for (let i = 0; i < 5; i++) {
      await expectUnauthorized(authService.loginTenant({ email, senha: "SenhaErrada123" }, {}));
    }

    // A 6ª tentativa, mesmo com a senha CORRETA, deve ser bloqueada pela camada HTTP real (controller + guard).
    const blocked = await request(app.getHttpServer()).post("/auth/tenant/login").send({ email, senha });
    expect(blocked.status).toBe(423);
    expect(blocked.body.message).toMatch(/bloqueada/i);
  }, 15_000);

  it("tenant: login correto reseta o contador de tentativas falhas", async () => {
    const { email, senha } = await signupTenant("lockout-reset");

    for (let i = 0; i < 3; i++) {
      await expectUnauthorized(authService.loginTenant({ email, senha: "SenhaErrada123" }, {}));
    }

    await authService.loginTenant({ email, senha }, {}); // não lança — reseta o contador

    // Mais 3 falhas após o reset — ainda abaixo do limiar de 5, não deveria bloquear.
    for (let i = 0; i < 3; i++) {
      await expectUnauthorized(authService.loginTenant({ email, senha: "SenhaErrada123" }, {}));
    }
    await expect(authService.loginTenant({ email, senha }, {})).resolves.toBeDefined();
  }, 15_000);

  it("master: bloqueia a conta de um MasterUser descartável após 5 tentativas falhas (sem afetar o MasterUser semeado)", async () => {
    const email = `master-lockout-${randomUUID().slice(0, 8)}@lockout-test.local`;
    const senha = "SenhaDeTeste123";
    const create = await superAdmin.post("/master/master-users").send({ nome: "Descartável", email, senha, role: "suporte" });
    expect(create.status).toBe(201);

    for (let i = 0; i < 5; i++) {
      await expectUnauthorized(masterAuthService.login({ email, senha: "SenhaErrada123" }, {}));
    }

    const blocked = await request(app.getHttpServer()).post("/auth/master/login").send({ email, senha });
    expect(blocked.status).toBe(423);

    // O MasterUser semeado (usado por todo o resto da suíte) continua acessível — nada vazou entre contas.
    await expect(masterAuthService.login({ email: process.env.MASTER_SEED_EMAIL as string, senha: process.env.MASTER_SEED_PASSWORD as string }, {})).resolves.toBeDefined();
  }, 15_000);
});
