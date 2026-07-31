import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Testes de integração do módulo CRM (Fase 3): módulo desativado bloqueia
 * acesso, deduplicação de contatos, funis/etapas, Kanban de oportunidades
 * e tarefas — sempre contra a infraestrutura real (mesmo padrão dos demais
 * arquivos de teste desta suíte).
 */
describe("CRM (Fase 3)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

  function randomCnpj(): string {
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) {
      throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@crm-test.local`;
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
    if (res.status !== 201) {
      throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) {
      throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    }
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("crm");
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("bloqueia /crm/contacts quando o módulo CRM não está ativo (403)", async () => {
    const res = await tenant.agent.get("/crm/contacts");
    expect(res.status).toBe(403);
  });

  it("Master ativa o módulo CRM para o tenant", async () => {
    const res = await superAdmin
      .patch(`/master/tenants/${tenant.tenantId}/modules`)
      .send({ module: "crm", enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it("cria um contato e detecta duplicidade pelo WhatsApp", async () => {
    const whatsapp = `5511${Math.floor(Math.random() * 900000000 + 100000000)}`;

    const create = await tenant.agent.post("/crm/contacts").send({ nome: "Primeiro Contato", whatsapp });
    expect(create.status).toBe(201);

    const duplicate = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Duplicado", whatsapp });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.contactId).toBe(create.body.id);
  });

  it("LGPD: exporta os dados pessoais de um contato e depois anonimiza sob pedido", async () => {
    const whatsapp = `5511${Math.floor(Math.random() * 900000000 + 100000000)}`;
    const contact = await tenant.agent.post("/crm/contacts").send({
      nome: "Cliente LGPD",
      email: "cliente-lgpd@teste.local",
      whatsapp,
      cpf: "12345678900",
    });
    expect(contact.status).toBe(201);

    const exported = await tenant.agent.get(`/crm/contacts/${contact.body.id}/lgpd/export`);
    expect(exported.status).toBe(200);
    expect(exported.body.nome).toBe("Cliente LGPD");
    expect(exported.body.email).toBe("cliente-lgpd@teste.local");
    expect(exported.body.opportunities).toEqual([]);
    expect(exported.body.tasks).toEqual([]);

    const anonymize = await tenant.agent.post(`/crm/contacts/${contact.body.id}/lgpd/anonymize`);
    expect(anonymize.status).toBe(201);
    expect(anonymize.body.nome).toBe("Contato removido (LGPD)");
    expect(anonymize.body.email).toBeNull();
    expect(anonymize.body.whatsapp).toBeNull();
    expect(anonymize.body.cpf).toBeNull();
    expect(anonymize.body.anonymizedAt).not.toBeNull();

    // Idempotente — chamar de novo não falha nem reverte o já anonimizado.
    const again = await tenant.agent.post(`/crm/contacts/${contact.body.id}/lgpd/anonymize`);
    expect(again.status).toBe(201);
    expect(again.body.nome).toBe("Contato removido (LGPD)");

    // O contato continua existindo (não é hard delete) — ainda aparece na listagem.
    const list = await tenant.agent.get("/crm/contacts");
    expect(list.body.some((c: { id: string }) => c.id === contact.body.id)).toBe(true);
  });

  it("reordena oportunidades dentro da mesma etapa do Kanban (Fase 27)", async () => {
    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `Funil Reordenação ${randomUUID().slice(0, 6)}` });
    const stage = await tenant.agent.post(`/crm/funnels/${funnel.body.id}/stages`).send({ nome: "Etapa Única", ordem: 0 });

    const contactA = await tenant.agent.post("/crm/contacts").send({ nome: "Oportunidade A" });
    const contactB = await tenant.agent.post("/crm/contacts").send({ nome: "Oportunidade B" });
    const contactC = await tenant.agent.post("/crm/contacts").send({ nome: "Oportunidade C" });

    const oppA = await tenant.agent.post("/crm/opportunities").send({ contactId: contactA.body.id, funnelId: funnel.body.id, stageId: stage.body.id });
    const oppB = await tenant.agent.post("/crm/opportunities").send({ contactId: contactB.body.id, funnelId: funnel.body.id, stageId: stage.body.id });
    const oppC = await tenant.agent.post("/crm/opportunities").send({ contactId: contactC.body.id, funnelId: funnel.body.id, stageId: stage.body.id });

    // Reordena para C, A, B.
    const reorder = await tenant.agent.post("/crm/opportunities/reorder").send({
      stageId: stage.body.id,
      orderedIds: [oppC.body.id, oppA.body.id, oppB.body.id],
    });
    expect(reorder.status).toBe(201);

    const list = await tenant.agent.get(`/crm/opportunities?stageId=${stage.body.id}`);
    expect(list.body.map((o: { id: string }) => o.id)).toEqual([oppC.body.id, oppA.body.id, oppB.body.id]);

    // Lista incompleta (faltando uma oportunidade da etapa) é rejeitada — não reordena parcialmente.
    const incomplete = await tenant.agent.post("/crm/opportunities/reorder").send({
      stageId: stage.body.id,
      orderedIds: [oppA.body.id, oppB.body.id],
    });
    expect(incomplete.status).toBe(400);
  });

  it("cria funil com etapas e uma oportunidade, move de etapa e fecha como ganha", async () => {
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Funil" });
    expect(contact.status).toBe(201);

    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: "Funil Comercial" });
    expect(funnel.status).toBe(201);

    const stage1 = await tenant.agent
      .post(`/crm/funnels/${funnel.body.id}/stages`)
      .send({ nome: "Novo Lead", ordem: 0, probabilidade: 10 });
    const stage2 = await tenant.agent
      .post(`/crm/funnels/${funnel.body.id}/stages`)
      .send({ nome: "Proposta Enviada", ordem: 1, probabilidade: 60 });
    expect(stage1.status).toBe(201);
    expect(stage2.status).toBe(201);

    const opportunity = await tenant.agent.post("/crm/opportunities").send({
      contactId: contact.body.id,
      funnelId: funnel.body.id,
      stageId: stage1.body.id,
      valor: 1500,
    });
    expect(opportunity.status).toBe(201);
    expect(opportunity.body.probabilidade).toBe(10);

    const moved = await tenant.agent
      .patch(`/crm/opportunities/${opportunity.body.id}/stage`)
      .send({ stageId: stage2.body.id });
    expect(moved.status).toBe(200);
    expect(moved.body.stageId).toBe(stage2.body.id);
    expect(moved.body.probabilidade).toBe(60);

    const won = await tenant.agent
      .patch(`/crm/opportunities/${opportunity.body.id}/close`)
      .send({ resultado: "won", motivo: "Cliente fechou negócio" });
    expect(won.status).toBe(200);
    expect(won.body.status).toBe("won");

    // Oportunidade encerrada não pode mais mudar de etapa.
    const moveAfterClose = await tenant.agent
      .patch(`/crm/opportunities/${opportunity.body.id}/stage`)
      .send({ stageId: stage1.body.id });
    expect(moveAfterClose.status).toBe(400);
  });

  it("cria e conclui uma tarefa vinculada a um contato", async () => {
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Tarefa" });

    const task = await tenant.agent.post("/crm/tasks").send({
      contactId: contact.body.id,
      tipo: "ligacao",
      titulo: "Ligar para confirmar interesse",
      dataHora: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(task.status).toBe(201);
    expect(task.body.status).toBe("pending");

    const completed = await tenant.agent.patch(`/crm/tasks/${task.body.id}`).send({ status: "done" });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("done");
    expect(completed.body.concluidaEm).not.toBeNull();
  });

  it("isolamento: outro tenant não vê nem edita contatos deste tenant", async () => {
    const otherTenant = await signupTenant("crm-other");
    await superAdmin.patch(`/master/tenants/${otherTenant.tenantId}/modules`).send({ module: "crm", enabled: true });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Contato Isolado" });
    expect(contact.status).toBe(201);

    const crossRead = await otherTenant.agent.get(`/crm/contacts/${contact.body.id}`);
    expect(crossRead.status).toBe(404);

    const crossEdit = await otherTenant.agent
      .patch(`/crm/contacts/${contact.body.id}`)
      .send({ nome: "Tentativa de invasão" });
    expect(crossEdit.status).toBe(404);

    const stillIntact = await prisma.contact.findUniqueOrThrow({ where: { id: contact.body.id } });
    expect(stillIntact.nome).toBe("Contato Isolado");
  });
});
