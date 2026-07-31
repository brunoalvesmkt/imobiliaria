import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { AppModule } from "../app.module";

/**
 * Fase 33 (ver DEVELOPMENT_PLAN.md): exportação XLSX como segundo formato
 * ao lado do CSV já existente (Fase 9/15) — mesma consulta ao banco, dois
 * formatos de saída. Confirma que o arquivo devolvido é um XLSX real (não
 * um CSV com Content-Type trocado) reabrindo o buffer com ExcelJS.
 */
describe("Relatórios — exportação XLSX (Fase 33)", () => {
  let app: INestApplication;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string };

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  /**
   * O Content-Type do XLSX não tem parser registrado no supertest/superagent
   * por padrão — sem isso, `res.body` viria vazio em vez do buffer binário.
   */
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
    const email = `${label}-${suffix}@reports-xlsx-test.local`;
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
    tenant = await signupTenant("reports-xlsx");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("exporta contatos em XLSX real (não um CSV disfarçado) com os mesmos dados do CSV", async () => {
    await tenant.agent.post("/crm/contacts").send({ nome: "Cliente XLSX Um" });
    await tenant.agent.post("/crm/contacts").send({ nome: "Cliente XLSX Dois" });

    const csv = await tenant.agent.get("/reports/export/contacts");
    expect(csv.status).toBe(200);
    expect(csv.header["content-type"]).toContain("text/csv");
    const csvLines = csv.text.trim().split("\n");

    const xlsx = await tenant.agent.get("/reports/export/contacts.xlsx").buffer(true).parse(binaryParser);
    expect(xlsx.status).toBe(200);
    expect(xlsx.header["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(xlsx.header["content-disposition"]).toContain("contatos.xlsx");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body as any);
    const sheet = workbook.worksheets[0];
    expect(sheet).toBeDefined();

    // Cabeçalho + N linhas de dado — mesma contagem do CSV (cabeçalho + N linhas).
    expect(sheet!.rowCount).toBe(csvLines.length);

    const headerRow = sheet!.getRow(1).values as unknown[];
    expect(headerRow).toContain("nome");

    const names = [];
    for (let i = 2; i <= sheet!.rowCount; i++) {
      names.push(sheet!.getRow(i).getCell(2).text);
    }
    expect(names).toEqual(expect.arrayContaining(["Cliente XLSX Um", "Cliente XLSX Dois"]));
  });

  it("outro tenant não consegue exportar dados do primeiro (isolamento também vale para XLSX)", async () => {
    const other = await signupTenant("reports-xlsx-other");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "crm", enabled: true });

    const xlsx = await other.agent.get("/reports/export/contacts.xlsx").buffer(true).parse(binaryParser);
    expect(xlsx.status).toBe(200);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body as any);
    const sheet = workbook.worksheets[0]!;
    // Só o cabeçalho — o outro tenant não tem contatos próprios.
    expect(sheet.rowCount).toBe(1);
  });
});
