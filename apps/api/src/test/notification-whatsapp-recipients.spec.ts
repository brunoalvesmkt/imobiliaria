import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { DomainEventsService } from "../common/events/domain-events.service";

/**
 * Notificações — múltiplos destinatários de WhatsApp administrativo (filtro por tipo, histórico de
 * envio) e templates editáveis por tipo (título/corpo com placeholders, criticidade configurável).
 */
describe("Notificações — destinatários e templates de WhatsApp administrativo", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let numberId: string;

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
    const email = `${label}-${suffix}@notif-recipients-test.local`;
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

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 8000, intervalMs = 150): Promise<T> {
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
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("notifrecip");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `55119${Math.floor(Math.random() * 90000000 + 10000000)}`,
    });
    numberId = numberRes.body.id as string;
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/confirm-connection`);
    await tenant.agent.patch("/notifications/settings/whatsapp").send({ whatsAppNumberId: numberId });

    // O limite de destinatários é igual à quantidade de usuários ativos do painel — este describe
    // cria vários destinatários no mesmo tenant ao longo dos testes, então precisa de "usuários"
    // suficientes (não precisam logar de verdade, só existir com status "active").
    const admin = await prisma.tenantUser.findUniqueOrThrow({ where: { id: tenant.userId } });
    await prisma.tenantUser.createMany({
      data: Array.from({ length: 8 }, (_, i) => ({
        tenantId: tenant.tenantId,
        nome: `Usuário Extra ${i}`,
        email: `extra-${i}-${randomUUID().slice(0, 8)}@notif-recipients-test.local`,
        passwordHash: admin.passwordHash,
        roleId: admin.roleId,
        status: "active",
      })),
    });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("filtra por tipo: só o destinatário com esse tipo (ou lista vazia) recebe, e grava o histórico", async () => {
    const onlyLeadHot = await tenant.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Só lead quente", numero: "5511900000001", tipos: ["contact.lead_hot"] });
    expect(onlyLeadHot.status).toBe(201);

    const onlyOverdue = await tenant.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Só retorno atrasado", numero: "5511900000002", tipos: ["crm_task.overdue"] });
    expect(onlyOverdue.status).toBe(201);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Lead Quente Teste" });
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", {
      tenantId: tenant.tenantId,
      contactId: contact.body.id,
      data: { contactId: contact.body.id, nome: contact.body.nome, score: 91 },
    });

    const delivery = await waitFor(() =>
      prisma.notificationWhatsappDelivery.findFirst({ where: { recipientId: onlyLeadHot.body.id, tipo: "contact.lead_hot" } }),
    );
    expect(delivery.status).toBe("sent");
    expect(delivery.mensagem).toContain("Lead Quente Teste");

    // O destinatário filtrado só por "crm_task.overdue" nunca deveria ter recebido nada deste evento.
    const wrongDelivery = await prisma.notificationWhatsappDelivery.findFirst({ where: { recipientId: onlyOverdue.body.id } });
    expect(wrongDelivery).toBeNull();

    const history = await tenant.agent.get(`/notifications/settings/whatsapp/recipients/${onlyLeadHot.body.id}/deliveries`);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].mensagem).toContain("Lead Quente Teste");
  }, 15_000);

  it("destinatário inativo não recebe, mesmo dentro do filtro de tipo", async () => {
    const recipient = await tenant.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Inativo", numero: "5511900000003", tipos: ["contact.lead_hot"] });
    expect(recipient.status).toBe(201);

    await tenant.agent.patch(`/notifications/settings/whatsapp/recipients/${recipient.body.id}`).send({ ativo: false });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Outro Lead" });
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", {
      tenantId: tenant.tenantId,
      contactId: contact.body.id,
      data: { contactId: contact.body.id, nome: contact.body.nome, score: 95 },
    });

    // Espera o suficiente para o evento processar (sem esperar por nada que nunca vai acontecer).
    await new Promise((r) => setTimeout(r, 1500));
    const delivery = await prisma.notificationWhatsappDelivery.findFirst({ where: { recipientId: recipient.body.id } });
    expect(delivery).toBeNull();
  }, 15_000);

  it("limite de destinatários é igual à quantidade de usuários do painel (inclui o admin principal)", async () => {
    const other = await signupTenant("notifrecip-limit");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "whatsapp", enabled: true });

    // Tenant novo com 1 único usuário (o admin do signup) — limite é 1.
    const first = await other.agent.post("/notifications/settings/whatsapp/recipients").send({ numero: "5511900000010" });
    expect(first.status).toBe(201);

    const second = await other.agent.post("/notifications/settings/whatsapp/recipients").send({ numero: "5511900000011" });
    expect(second.status).toBe(400);
  }, 15_000);

  it("migração automática do destinoNumero antigo não consome a vaga do primeiro destinatário cadastrado manualmente", async () => {
    const other = await signupTenant("notifrecip-legacy");
    await superAdmin.patch(`/master/tenants/${other.tenantId}/modules`).send({ module: "whatsapp", enabled: true });

    // Simula um tenant que já tinha o número de destino antigo configurado (modelo pré-refatoração),
    // guardado solto em FeatureFlag("configuracoes").config — mesmo formato que `migrateLegacyDestino` lê.
    await prisma.featureFlag.upsert({
      where: { tenantId_module: { tenantId: other.tenantId, module: "configuracoes" } },
      create: { tenantId: other.tenantId, module: "configuracoes", enabled: true, config: { notificacaoWhatsapp: { destinoNumero: "5511988887777" } } },
      update: { config: { notificacaoWhatsapp: { destinoNumero: "5511988887777" } } },
    });

    // A primeira leitura da lista dispara a migração automática (tenant tem só 1 usuário ativo).
    const list = await other.agent.get("/notifications/settings/whatsapp/recipients");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].origem).toBe("migrated");

    // O destinatário cadastrado de verdade pelo usuário não pode ser bloqueado pela vaga já consumida
    // pela migração — só destinatários "manual" contam para o limite.
    const created = await other.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Bruno", numero: "5511969382469" });
    expect(created.status).toBe(201);
    expect(created.body.origem).toBe("manual");
  }, 15_000);

  it("templates: editar o corpo com placeholder muda a mensagem realmente enviada, e reset volta ao padrão", async () => {
    const recipient = await tenant.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Template custom", numero: "5511900000020", tipos: ["contact.lead_hot"] });
    expect(recipient.status).toBe(201);

    const update = await tenant.agent
      .patch("/notifications/settings/templates/contact.lead_hot")
      .send({ titulo: "🔥 Lead quente!", corpo: "Corre lá: {{nome}} ficou quente." });
    expect(update.status).toBe(200);
    expect(update.body.customized).toBe(true);

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Fulano Customizado" });
    const domainEvents = app.get(DomainEventsService);
    domainEvents.emit("contact.lead_hot", {
      tenantId: tenant.tenantId,
      contactId: contact.body.id,
      data: { contactId: contact.body.id, nome: contact.body.nome, score: 99 },
    });

    const delivery = await waitFor(() =>
      prisma.notificationWhatsappDelivery.findFirst({ where: { recipientId: recipient.body.id, tipo: "contact.lead_hot", mensagem: { contains: "Fulano Customizado" } } }),
    );
    expect(delivery.mensagem).toBe("🔥 Lead quente!\nCorre lá: Fulano Customizado ficou quente.");

    const reset = await tenant.agent.delete("/notifications/settings/templates/contact.lead_hot");
    expect(reset.status).toBe(200);
    expect(reset.body.customized).toBe(false);
    expect(reset.body.titulo).toBe("Lead quente");
  }, 15_000);

  it("templates: marcar um tipo não-crítico como crítico faz ele também disparar WhatsApp", async () => {
    const recipient = await tenant.agent
      .post("/notifications/settings/whatsapp/recipients")
      .send({ nome: "Recebe tudo", numero: "5511900000030" }); // tipos vazio = recebe tudo
    expect(recipient.status).toBe(201);

    // "conversation.created" não é crítico por padrão — confirma que hoje não dispara WhatsApp.
    const beforeCount = await prisma.notificationWhatsappDelivery.count({ where: { recipientId: recipient.body.id, tipo: "conversation.created" } });
    expect(beforeCount).toBe(0);

    const makeCriticalRes = await tenant.agent.patch("/notifications/settings/templates/conversation.created").send({ critical: true });
    expect(makeCriticalRes.status).toBe(200);
    expect(makeCriticalRes.body.critical).toBe(true);

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511955550000",
      conteudo: "Oi, preciso de ajuda",
    });
    expect(incoming.status).toBe(201);

    const delivery = await waitFor(() =>
      prisma.notificationWhatsappDelivery.findFirst({ where: { recipientId: recipient.body.id, tipo: "conversation.created" } }),
    );
    expect(delivery.status).toBe("sent");
  }, 15_000);
});
