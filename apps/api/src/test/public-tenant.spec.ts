import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";

/**
 * Testes de resolução de tenant por subdomínio (Fase 20): endpoint público
 * `GET /public/tenant/branding`, usado por uma tela de login com a marca da
 * empresa antes de qualquer autenticação — resolve pelo header `Host` da
 * requisição, nunca por um campo livre do corpo/query (mesmo princípio de
 * "nunca confiar tenant de entrada não verificada" já usado nos webhooks).
 */
describe("Resolução de tenant por subdomínio (Fase 20)", () => {
  let app: INestApplication;

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
    const email = `${label}-${suffix}@subdomain-test.local`;
    const senha = "SenhaDeTeste123";
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/tenant/signup").send({
      razaoSocial: `Empresa Subdominio ${suffix}`,
      cnpj: randomCnpj(),
      responsavel: `Responsavel ${label}`,
      email,
      confirmacaoEmail: email,
      senha,
      confirmacaoSenha: senha,
      ...(await signupExtras(app)),
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/tenants/me");
    return { agent, subdominio: me.body.subdominio as string, razaoSocial: me.body.razaoSocial as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("resolve a marca (nome/logo) do tenant pelo subdomínio no header Host", async () => {
    const tenant = await signupTenant("branding");

    const res = await request(app.getHttpServer())
      .get("/public/tenant/branding")
      .set("Host", `${tenant.subdominio}.plataforma.local`);

    expect(res.status).toBe(200);
    expect(res.body.subdominio).toBe(tenant.subdominio);
    expect(res.body.razaoSocial).toBe(tenant.razaoSocial);
  });

  it("404 para um subdomínio que não existe — nunca vaza dados de outro tenant", async () => {
    const res = await request(app.getHttpServer())
      .get("/public/tenant/branding")
      .set("Host", `subdominio-que-nao-existe-${randomUUID().slice(0, 8)}.plataforma.local`);
    expect(res.status).toBe(404);
  });

  it("não exige autenticação (endpoint público, usado antes do login)", async () => {
    const tenant = await signupTenant("public");
    const res = await request(app.getHttpServer())
      .get("/public/tenant/branding")
      .set("Host", `${tenant.subdominio}.plataforma.local`);
    // Nenhum cookie de sessão enviado — supertest sem `.agent()` não carrega cookies.
    expect(res.status).toBe(200);
  });
});
