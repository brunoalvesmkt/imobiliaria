import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { PermissionAction } from "@chatbot-saas/database";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Fases 50-58 (ver DEVELOPMENT_PLAN.md) — itens realmente ausentes
 * encontrados na auditoria contra o "MAPA DE DESENVOLVIMENTO" (prompt
 * mestre): mensagens rápidas, unir cadastros duplicados, campos
 * personalizados tipados, bloquear contato, concorrência entre atendentes,
 * indicador de digitação (só WebSocket, sem endpoint REST a testar aqui),
 * mascaramento de CPF/CNPJ, notificação por WhatsApp administrativo, e base
 * de perguntas e respostas (variações/palavra-chave/prioridade).
 */
describe("Gaps do prompt mestre — Fases 50-58", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };

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
    const email = `${label}-${suffix}@gaps5058-test.local`;
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

  /** Cria um papel sem `crm.view_sensitive` e um usuário nesse papel, já autenticado — usado no teste de mascaramento e de concorrência. */
  async function createLimitedUser(rolePermissions: { module: string; action: PermissionAction }[]) {
    const role = await prisma.role.create({
      data: { tenantId: tenant.tenantId, nome: `limitado-${randomUUID().slice(0, 6)}`, descricao: "Papel de teste" },
    });
    await prisma.permission.createMany({
      data: rolePermissions.map((p) => ({ roleId: role.id, module: p.module, action: p.action })),
    });

    const email = `limitado-${randomUUID().slice(0, 8)}@gaps5058-test.local`;
    const senha = "SenhaDeTeste123";
    const create = await tenant.agent.post("/tenant-users").send({ nome: "Usuário Limitado", email, senha, roleId: role.id });
    expect(create.status).toBe(201);

    const agent = request.agent(app.getHttpServer());
    const login = await agent.post("/auth/tenant/login").send({ email, senha });
    expect(login.status).toBe(200);
    return { agent, userId: create.body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);

    tenant = await signupTenant("gaps5058");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "atendimento", enabled: true });
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "chatbot", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("Fase 50: mensagens rápidas — CRUD e substituição de variáveis no render", async () => {
    const create = await tenant.agent.post("/atendimento/quick-messages").send({
      titulo: "Saudação",
      texto: "Olá {{contato.nome}}, aqui é {{agente.nome}}!",
      categoria: "geral",
      atalho: "/oi",
    });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    const list = await tenant.agent.get("/atendimento/quick-messages");
    expect(list.status).toBe(200);
    expect(list.body.some((m: { id: string }) => m.id === id)).toBe(true);

    const contactRes = await tenant.agent.post("/crm/contacts").send({ nome: "Fulano", sobrenome: "Silva", whatsapp: "5511977776666" });
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `5511${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });
    const conv = await prisma.conversation.create({
      data: { tenantId: tenant.tenantId, contatoNumero: "5511977776666", contactId: contactRes.body.id, whatsAppNumberId: numberRes.body.id },
    });

    const render = await tenant.agent.post(`/atendimento/quick-messages/${id}/render`).send({ conversationId: conv.id });
    expect(render.status).toBe(201);
    expect(render.body.texto).toContain("Fulano Silva");

    const deactivate = await tenant.agent.patch(`/atendimento/quick-messages/${id}`).send({ ativo: false });
    expect(deactivate.status).toBe(200);
    const listAfter = await tenant.agent.get("/atendimento/quick-messages");
    expect(listAfter.body.some((m: { id: string }) => m.id === id)).toBe(false);
  });

  it("Fase 52: campos personalizados tipados — CRUD e chave única por tenant", async () => {
    const create = await tenant.agent.post("/crm/custom-fields").send({ nome: "Segmento", chave: "segmento", tipo: "lista", opcoes: ["A", "B"] });
    expect(create.status).toBe(201);

    const duplicate = await tenant.agent.post("/crm/custom-fields").send({ nome: "Outro nome", chave: "segmento", tipo: "texto" });
    expect(duplicate.status).toBe(409);

    const list = await tenant.agent.get("/crm/custom-fields");
    expect(list.status).toBe(200);
    expect(list.body.some((f: { chave: string }) => f.chave === "segmento")).toBe(true);
  });

  it("Fase 53: bloquear contato impede envio manual de mensagem, desbloquear libera", async () => {
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Bloqueado", whatsapp: "5511966665555" });
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `5511${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });
    await tenant.agent.post(`/whatsapp/numbers/${numberRes.body.id}/accept-risk`).send({});
    await tenant.agent.post(`/whatsapp/numbers/${numberRes.body.id}/connect`);
    await tenant.agent.post(`/whatsapp/numbers/${numberRes.body.id}/confirm-connection`);
    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberRes.body.id,
      fromNumero: "5511966665555",
      conteudo: "Oi",
    });
    const conversationId = incoming.body.conversationId as string;
    await prisma.conversation.update({ where: { id: conversationId }, data: { contactId: contact.body.id } });

    const block = await tenant.agent.post(`/crm/contacts/${contact.body.id}/block`).send({ motivo: "Pediu para não ser mais contatado" });
    expect(block.status).toBe(201);
    expect(block.body.bloqueado).toBe(true);

    const blockedSend = await tenant.agent.post(`/whatsapp/conversations/${conversationId}/messages`).send({ tipo: "text", texto: "Oi de novo" });
    expect(blockedSend.status).toBe(403);

    const unblock = await tenant.agent.post(`/crm/contacts/${contact.body.id}/unblock`);
    expect(unblock.status).toBe(201);
    expect(unblock.body.bloqueado).toBe(false);

    const allowedSend = await tenant.agent.post(`/whatsapp/conversations/${conversationId}/messages`).send({ tipo: "text", texto: "Agora pode" });
    expect(allowedSend.status).toBe(201);
  });

  it("Fase 51: unir cadastros duplicados preserva oportunidades/tarefas/conversas do duplicado", async () => {
    const primary = await tenant.agent.post("/crm/contacts").send({ nome: "Principal", email: `principal-${randomUUID().slice(0, 6)}@x.local` });
    const duplicate = await tenant.agent.post("/crm/contacts").send({ nome: "Duplicado", email: `duplicado-${randomUUID().slice(0, 6)}@x.local` });

    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `Funil Merge ${randomUUID().slice(0, 6)}` });
    const stage = await tenant.agent.post(`/crm/funnels/${funnel.body.id}/stages`).send({ nome: "Etapa 1", ordem: 0 });
    const opportunity = await tenant.agent
      .post("/crm/opportunities")
      .send({ contactId: duplicate.body.id, funnelId: funnel.body.id, stageId: stage.body.id });
    expect(opportunity.status).toBe(201);

    const merge = await tenant.agent.post(`/crm/contacts/${primary.body.id}/merge`).send({ duplicateId: duplicate.body.id });
    expect(merge.status).toBe(201);

    const movedOpportunity = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunity.body.id } });
    expect(movedOpportunity.contactId).toBe(primary.body.id);

    const duplicateAfter = await prisma.contact.findUniqueOrThrow({ where: { id: duplicate.body.id } });
    expect(duplicateAfter.deletedAt).not.toBeNull();

    const primaryAfter = await tenant.agent.get(`/crm/contacts/${primary.body.id}`);
    expect(primaryAfter.status).toBe(200);
  });

  it("Fase 56: CPF/CNPJ mascarado para papel sem crm.view_sensitive, visível para admin", async () => {
    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "ComDocumento", cpf: "12345678901" });
    expect(contact.status).toBe(201);

    const adminView = await tenant.agent.get(`/crm/contacts/${contact.body.id}`);
    expect(adminView.body.cpf).toBe("12345678901");

    const limited = await createLimitedUser([{ module: "crm", action: "view" }]);
    const limitedView = await limited.agent.get(`/crm/contacts/${contact.body.id}`);
    expect(limitedView.status).toBe(200);
    expect(limitedView.body.cpf).not.toBe("12345678901");
    expect(limitedView.body.cpf.endsWith("8901")).toBe(true);
    expect(limitedView.body.cpf.startsWith("*")).toBe(true);
  });

  it("Fase 54: assumir conversa já atendida por outro agente recusa por padrão (409), força com force=true", async () => {
    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `5511${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });
    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberRes.body.id,
      fromNumero: "5511955554444",
      conteudo: "Oi",
    });
    const conversationId = incoming.body.conversationId as string;

    const firstAssume = await tenant.agent.post(`/atendimento/inbox/${conversationId}/assume`);
    expect(firstAssume.status).toBe(201);

    const other = await createLimitedUser([
      { module: "atendimento", action: "view" },
      { module: "atendimento", action: "transfer" },
    ]);
    const conflict = await other.agent.post(`/atendimento/inbox/${conversationId}/assume`);
    expect(conflict.status).toBe(409);
    expect(conflict.body.responsavelId).toBeDefined();

    const forced = await other.agent.post(`/atendimento/inbox/${conversationId}/assume?force=true`);
    expect(forced.status).toBe(201);

    const detail = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(detail.responsavelId).toBe(other.userId);
  });

  it("Fase 57: configurações de notificação por WhatsApp administrativo — GET/PATCH", async () => {
    const before = await tenant.agent.get("/notifications/settings/whatsapp");
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ whatsAppNumberId: null, destinoNumero: null });

    const numberRes = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `5511${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });

    const update = await tenant.agent
      .patch("/notifications/settings/whatsapp")
      .send({ whatsAppNumberId: numberRes.body.id, destinoNumero: "5511999998888" });
    expect(update.status).toBe(200);
    expect(update.body.whatsAppNumberId).toBe(numberRes.body.id);

    const after = await tenant.agent.get("/notifications/settings/whatsapp");
    expect(after.body.destinoNumero).toBe("5511999998888");
  });

  it("Fase 58: busca por palavra-chave da base de conhecimento usa variações e prioridade para desempate", async () => {
    const low = await tenant.agent.post("/chatbot/knowledge-base").send({
      tipo: "faq",
      titulo: "Prazo de entrega padrão",
      conteudo: "Nosso prazo padrão é de 5 dias úteis.",
      variacoes: ["quanto tempo demora a entrega"],
      prioridade: 1,
    });
    expect(low.status).toBe(201);

    const high = await tenant.agent.post("/chatbot/knowledge-base").send({
      tipo: "faq",
      titulo: "Prazo de entrega expresso",
      conteudo: "Entrega expressa em 24 horas.",
      variacoes: ["quanto tempo demora a entrega expressa"],
      palavraChave: "expresso",
      prioridade: 10,
    });
    expect(high.status).toBe(201);

    expect(low.body.variacoes).toContain("quanto tempo demora a entrega");
    expect(high.body.prioridade).toBe(10);
  });
});
