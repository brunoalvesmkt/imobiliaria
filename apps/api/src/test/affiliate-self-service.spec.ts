import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";

/**
 * Fase 32 (ver DEVELOPMENT_PLAN.md): painel de autoatendimento do afiliado
 * — login próprio (após o Master definir uma senha) e leitura das próprias
 * comissões/indicações, nunca de outro afiliado.
 */
describe("Afiliados — autoatendimento (Fase 32)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  function randomCpf(): string {
    return Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function createAffiliate(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@affiliate-self-test.local`;
    const res = await superAdmin.post("/master/affiliates").send({
      nome: `Afiliado ${label}`,
      sobrenome: "Teste",
      cpf: randomCpf(),
      email,
    });
    if (res.status !== 201) throw new Error(`Criação de afiliado falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return { id: res.body.id as string, email };
  }

  beforeAll(async () => {
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
  });

  it("afiliado sem senha definida não consegue entrar; Master define senha e o login passa a funcionar", async () => {
    const { id, email } = await createAffiliate("sem-senha");

    const beforeSet = await request(app.getHttpServer()).post("/auth/affiliate/login").send({ email, senha: "QualquerSenha123" });
    expect(beforeSet.status).toBe(401);

    const setPassword = await superAdmin.patch(`/master/affiliates/${id}/password`).send({ senha: "SenhaDoAfiliado123" });
    expect(setPassword.status).toBe(200);
    expect(setPassword.body).toEqual({ id, passwordSet: true });

    const wrongPassword = await request(app.getHttpServer()).post("/auth/affiliate/login").send({ email, senha: "SenhaErrada123" });
    expect(wrongPassword.status).toBe(401);

    const affiliateAgent = request.agent(app.getHttpServer());
    const login = await affiliateAgent.post("/auth/affiliate/login").send({ email, senha: "SenhaDoAfiliado123" });
    expect(login.status).toBe(200);

    const me = await affiliateAgent.get("/auth/affiliate/me");
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(id);
    expect(me.body.email).toBe(email);
  });

  it("afiliado autenticado só vê as próprias comissões e indicações — nunca de outro afiliado", async () => {
    const affiliateA = await createAffiliate("a");
    const affiliateB = await createAffiliate("b");
    await superAdmin.patch(`/master/affiliates/${affiliateA.id}/password`).send({ senha: "SenhaAfiliadoA123" });
    await superAdmin.patch(`/master/affiliates/${affiliateB.id}/password`).send({ senha: "SenhaAfiliadoB123" });

    await superAdmin.post(`/master/affiliates/${affiliateA.id}/commissions`).send({ tipo: "percentual", valor: 10 });
    await superAdmin.post(`/master/affiliates/${affiliateB.id}/commissions`).send({ tipo: "percentual", valor: 20 });

    const agentA = request.agent(app.getHttpServer());
    await agentA.post("/auth/affiliate/login").send({ email: affiliateA.email, senha: "SenhaAfiliadoA123" });

    const commissionsA = await agentA.get("/affiliate/me/commissions");
    expect(commissionsA.status).toBe(200);
    expect(commissionsA.body).toHaveLength(1);
    expect(Number(commissionsA.body[0].valor)).toBe(10);

    const referralsA = await agentA.get("/affiliate/me/referrals");
    expect(referralsA.status).toBe(200);
    expect(Array.isArray(referralsA.body)).toBe(true);
  });

  it("logout encerra a sessão — /auth/affiliate/me passa a exigir novo login", async () => {
    const { id, email } = await createAffiliate("logout");
    await superAdmin.patch(`/master/affiliates/${id}/password`).send({ senha: "SenhaDeLogout123" });

    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/affiliate/login").send({ email, senha: "SenhaDeLogout123" });
    expect((await agent.get("/auth/affiliate/me")).status).toBe(200);

    const logout = await agent.post("/auth/affiliate/logout");
    expect(logout.status).toBe(200);

    expect((await agent.get("/auth/affiliate/me")).status).toBe(401);
  });
});
