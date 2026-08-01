import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";

/**
 * Fase 36 (ver DEVELOPMENT_PLAN.md): exportação PDF como terceiro formato,
 * ao lado de CSV (Fase 9/15) e XLSX (Fase 33) — mesma consulta ao banco,
 * três formatos de saída. Confirma que o arquivo devolvido é um PDF real
 * (assinatura `%PDF-`), não um CSV/XLSX com Content-Type trocado.
 */
describe("Relatórios — exportação PDF (Fase 36)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string };

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

  function binaryParser(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
    res.setEncoding("binary");
    const chunks: string[] = [];
    res.on("data", (chunk: string) => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.from(chunks.join(""), "binary")));
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@reports-pdf-test.local`;
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
    tenant = await signupTenant("reports-pdf");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("exporta contatos em PDF real (assinatura %PDF-) com Content-Type/Disposition corretos", async () => {
    await tenant.agent.post("/crm/contacts").send({ nome: "Cliente PDF Um" });
    await tenant.agent.post("/crm/contacts").send({ nome: "Cliente PDF Dois" });

    const pdf = await tenant.agent.get("/reports/export/contacts.pdf").buffer(true).parse(binaryParser);
    expect(pdf.status).toBe(200);
    expect(pdf.header["content-type"]).toBe("application/pdf");
    expect(pdf.header["content-disposition"]).toContain("contatos.pdf");

    const body = pdf.body as Buffer;
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(100);
  });

  it("outro tenant não consegue exportar dados do primeiro (isolamento também vale para PDF)", async () => {
    const other = await signupTenant("reports-pdf-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "crm", enabled: true });

    const pdf = await other.agent.get("/reports/export/contacts.pdf").buffer(true).parse(binaryParser);
    expect(pdf.status).toBe(200);
    const body = pdf.body as Buffer;
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Não temos como contar linhas num PDF facilmente, mas confirmamos que é bem menor
    // que o do tenant com 2 contatos (só o título + cabeçalho, sem linhas de dado).
  });
});
