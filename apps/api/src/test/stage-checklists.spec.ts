import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Roteiros de Etapas — checklist configurável por etapa do funil que
 * bloqueia a movimentação MANUAL de uma oportunidade até que todos os itens
 * ativos tenham resposta (ver StageChecklistsService.enforceStageChecklist).
 */
describe("CRM — Roteiros de Etapas", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let funnelId: string;
  let stageAId: string;
  let stageBId: string;
  let contactId: string;

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
    const email = `${label}-${suffix}@stage-checklists-test.local`;
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

    tenant = await signupTenant("stagechecklist");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "crm", enabled: true });

    const contact = await tenant.agent.post("/crm/contacts").send({ nome: "Cliente Roteiro" });
    contactId = contact.body.id as string;
    const funnel = await tenant.agent.post("/crm/funnels").send({ nome: `Funil Roteiro ${randomUUID().slice(0, 6)}` });
    funnelId = funnel.body.id as string;
    const stageA = await tenant.agent.post(`/crm/funnels/${funnelId}/stages`).send({ nome: "Etapa A", ordem: 0 });
    stageAId = stageA.body.id as string;
    const stageB = await tenant.agent.post(`/crm/funnels/${funnelId}/stages`).send({ nome: "Etapa B", ordem: 1 });
    stageBId = stageB.body.id as string;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  async function createOpportunity(stageId: string = stageAId) {
    const res = await tenant.agent.post("/crm/opportunities").send({ contactId, funnelId, stageId });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  /** Par de etapas isolado por teste — evita que itens de roteiro criados num teste "vazem" para outro que reusa a mesma etapa de origem. */
  async function createFreshStagePair() {
    const suffix = randomUUID().slice(0, 6);
    const origin = await tenant.agent.post(`/crm/funnels/${funnelId}/stages`).send({ nome: `Origem ${suffix}`, ordem: 5 });
    expect(origin.status).toBe(201);
    const target = await tenant.agent.post(`/crm/funnels/${funnelId}/stages`).send({ nome: `Destino ${suffix}`, ordem: 6 });
    expect(target.status).toBe(201);
    return { originStageId: origin.body.id as string, targetStageId: target.body.id as string };
  }

  it("etapa sem roteiro ativo move livre, sem exigir nada", async () => {
    const opportunityId = await createOpportunity();
    const move = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({ stageId: stageBId });
    expect(move.status).toBe(200);
    expect(move.body.stageId).toBe(stageBId);
  });

  it("bloqueia mover sem responder todos os itens do roteiro da etapa de origem", async () => {
    const item1 = await tenant.agent.post("/crm/stage-checklists").send({ stageId: stageAId, titulo: "Confirmar orçamento" });
    expect(item1.status).toBe(201);
    const item2 = await tenant.agent.post("/crm/stage-checklists").send({ stageId: stageAId, titulo: "Validar prazo" });
    expect(item2.status).toBe(201);

    const opportunityId = await createOpportunity();

    // Sem checklist nenhum respondido — bloqueia.
    const moveNoAnswers = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({ stageId: stageBId });
    expect(moveNoAnswers.status).toBe(400);
    expect(moveNoAnswers.body.message).toContain("Confirmar orçamento");

    // Só um dos dois itens respondido — ainda bloqueia, cita o item pendente.
    const movePartial = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({
      stageId: stageBId,
      checklist: [{ itemId: item1.body.id, resultado: "concluido" }],
    });
    expect(movePartial.status).toBe(400);
    expect(movePartial.body.message).toContain("Validar prazo");

    // Confirma que a oportunidade continua na etapa A (não moveu parcialmente).
    const stillThere = await tenant.agent.get(`/crm/opportunities/${opportunityId}`);
    expect(stillThere.body.stageId).toBe(stageAId);

    // Com os dois itens respondidos — move.
    const moveComplete = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({
      stageId: stageBId,
      checklist: [
        { itemId: item1.body.id, resultado: "concluido" },
        { itemId: item2.body.id, resultado: "concluido" },
      ],
    });
    expect(moveComplete.status).toBe(200);
    expect(moveComplete.body.stageId).toBe(stageBId);
  });

  it("exige motivo quando o item é 'não concluído' e tem obrigatorioMotivo=true", async () => {
    const { originStageId, targetStageId } = await createFreshStagePair();
    const item = await tenant.agent.post("/crm/stage-checklists").send({
      stageId: originStageId,
      titulo: "Item com motivo obrigatório",
      obrigatorioMotivo: true,
    });
    expect(item.status).toBe(201);

    const opportunityId = await createOpportunity(originStageId);

    // "não concluído" sem motivo — bloqueia.
    const moveWithoutMotivo = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({
      stageId: targetStageId,
      checklist: [{ itemId: item.body.id, resultado: "nao_concluido" }],
    });
    expect(moveWithoutMotivo.status).toBe(400);

    // Com motivo — passa.
    const moveWithMotivo = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({
      stageId: targetStageId,
      checklist: [{ itemId: item.body.id, resultado: "nao_concluido", motivo: "Cliente pediu mais prazo" }],
    });
    expect(moveWithMotivo.status).toBe(200);
  });

  it("histórico é imutável — editar o item depois não muda o snapshot já gravado", async () => {
    const { originStageId, targetStageId } = await createFreshStagePair();
    const item = await tenant.agent.post("/crm/stage-checklists").send({ stageId: originStageId, titulo: "Título original" });
    expect(item.status).toBe(201);

    const opportunityId = await createOpportunity(originStageId);
    const move = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({
      stageId: targetStageId,
      checklist: [{ itemId: item.body.id, resultado: "concluido" }],
    });
    expect(move.status).toBe(200);

    // Edita o título do item DEPOIS do snapshot já gravado.
    const update = await tenant.agent.patch(`/crm/stage-checklists/${item.body.id}`).send({ titulo: "Título editado depois" });
    expect(update.status).toBe(200);

    const history = await tenant.agent.get(`/crm/stage-checklists/opportunity/${opportunityId}/history`);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    const snapshotItem = history.body[0].itens.find((i: { itemId: string }) => i.itemId === item.body.id);
    expect(snapshotItem.titulo).toBe("Título original");

    // Confirma direto no banco também — histórico não referencia o item vivo.
    const fill = await prisma.opportunityStageChecklistFill.findFirst({ where: { opportunityId } });
    const itens = fill!.itens as { itemId: string; titulo: string }[];
    expect(itens.find((i) => i.itemId === item.body.id)?.titulo).toBe("Título original");
  });

  it("roteiro marcável (progresso) alimenta o fallback do moveStage quando 'checklist' não vem no corpo", async () => {
    const { originStageId, targetStageId } = await createFreshStagePair();
    const item = await tenant.agent.post("/crm/stage-checklists").send({ stageId: originStageId, titulo: "Item marcado na ficha" });
    expect(item.status).toBe(201);

    const opportunityId = await createOpportunity(originStageId);

    // Marca o progresso via endpoint dedicado (simula marcar na ficha da oportunidade).
    const progress = await tenant.agent.patch(`/crm/stage-checklists/opportunity/${opportunityId}/progress`).send({
      itemId: item.body.id,
      resultado: "concluido",
    });
    expect(progress.status).toBe(200);

    // Move SEM enviar "checklist" no corpo — usa o fallback do progresso já salvo.
    const move = await tenant.agent.patch(`/crm/opportunities/${opportunityId}/stage`).send({ stageId: targetStageId });
    expect(move.status).toBe(200);

    // Progresso da etapa de origem é limpo depois do snapshot.
    const remainingProgress = await prisma.opportunityChecklistProgress.findMany({ where: { opportunityId, stageId: originStageId } });
    expect(remainingProgress).toHaveLength(0);
  });
});
