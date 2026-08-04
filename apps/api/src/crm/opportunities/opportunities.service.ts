import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { FollowUpsService } from "../../automation/followups.service";
import type { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import type { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import type { MoveStageDto } from "./dto/move-stage.dto";
import type { CloseOpportunityDto } from "./dto/close-opportunity.dto";

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly followUps: FollowUpsService,
  ) {}

  async list(funnelId?: string, stageId?: string) {
    const tenantId = requireCurrentTenantId();
    const where: Prisma.OpportunityWhereInput = { deletedAt: null, tenantId };
    if (funnelId) where.funnelId = funnelId;
    if (stageId) where.stageId = stageId;
    // Consulta direta ao PrismaService (em vez do wrapper tenantPrisma.opportunity, cujo
    // tipo fixo de retorno não preserva a relação "include" abaixo) — tenantId já filtrado acima.
    const opportunities = await this.prisma.opportunity.findMany({
      where,
      orderBy: [{ ordem: "asc" }, { createdAt: "desc" }],
      include: {
        contact: { select: { id: true, nome: true, whatsapp: true } },
        // Linha "aberta" (exitedAt nulo) do histórico é a etapa atual — usada pelo
        // Kanban para mostrar há quanto tempo a oportunidade está na etapa em que se encontra.
        stageHistory: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1, select: { enteredAt: true } },
      },
    });

    return opportunities.map(({ stageHistory, ...o }) => ({
      ...o,
      stageEnteredAt: stageHistory[0]?.enteredAt ?? o.createdAt,
    }));
  }

  async get(id: string) {
    const opportunity = await this.tenantPrisma.opportunity.findFirst({
      where: { id, deletedAt: null },
      include: { contact: true, stage: true, funnel: true },
    });
    if (!opportunity) {
      throw new NotFoundException("Oportunidade não encontrada.");
    }
    return opportunity;
  }

  async create(dto: CreateOpportunityDto, actorId: string) {
    const tenantId = requireCurrentTenantId();

    const [contact, stage] = await Promise.all([
      this.tenantPrisma.contact.findFirst({ where: { id: dto.contactId, deletedAt: null } }),
      this.prisma.funnelStage.findFirst({
        where: { id: dto.stageId, funnelId: dto.funnelId, funnel: { tenantId } },
      }),
    ]);
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const opportunity = await this.tenantPrisma.opportunity.create({
      data: {
        contactId: dto.contactId,
        funnelId: dto.funnelId,
        stageId: dto.stageId,
        valor: dto.valor ?? null,
        probabilidade: stage.probabilidade,
        produto: dto.produto ?? null,
        servico: dto.servico ?? null,
        responsavelId: dto.responsavelId ?? null,
        previsaoFechamento: dto.previsaoFechamento ? new Date(dto.previsaoFechamento) : null,
        origem: dto.origem ?? null,
        campanha: dto.campanha ?? null,
        observacoes: dto.observacoes ?? null,
      },
    });

    await this.tenantPrisma.opportunityStageHistory.create({
      data: { opportunityId: opportunity.id, stageId: opportunity.stageId },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.create",
      entity: "Opportunity",
      entityId: opportunity.id,
      newData: { contactId: opportunity.contactId, stageId: opportunity.stageId },
    });

    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto, actorId: string) {
    await this.get(id);

    const data: Prisma.OpportunityUncheckedUpdateInput = {};
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.produto !== undefined) data.produto = dto.produto;
    if (dto.servico !== undefined) data.servico = dto.servico;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.previsaoFechamento !== undefined) data.previsaoFechamento = new Date(dto.previsaoFechamento);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    const updated = await this.tenantPrisma.opportunity.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.update",
      entity: "Opportunity",
      entityId: id,
    });

    return updated;
  }

  async moveStage(id: string, dto: MoveStageDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.get(id);

    if (opportunity.status !== "open") {
      throw new BadRequestException("Oportunidade já encerrada (ganha/perdida) não pode mudar de etapa.");
    }

    const stage = await this.prisma.funnelStage.findFirst({
      where: { id: dto.stageId, funnelId: opportunity.funnelId, funnel: { tenantId } },
    });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const updated = await this.tenantPrisma.opportunity.update({
      where: { id },
      data: { stageId: dto.stageId, probabilidade: stage.probabilidade },
    });

    await this.closeOpenStageHistory(id);
    await this.tenantPrisma.opportunityStageHistory.create({ data: { opportunityId: id, stageId: dto.stageId } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.stage_changed",
      entity: "Opportunity",
      entityId: id,
      previousData: { stageId: opportunity.stageId },
      newData: { stageId: dto.stageId },
    });

    this.domainEvents.emit("opportunity.stage_changed", {
      tenantId,
      contactId: opportunity.contactId,
      opportunityId: id,
      data: { opportunityId: id, stageId: dto.stageId, stageIdAnterior: opportunity.stageId },
    });

    return updated;
  }

  /**
   * Reordena as oportunidades dentro de uma mesma etapa do Kanban (Fase 27)
   * — recebe a lista de ids na ordem final desejada e grava `ordem` como o
   * índice de cada uma. Não muda a etapa de nenhuma oportunidade (isso é
   * `moveStage`) — só a posição visual dentro da coluna atual.
   */
  async reorder(stageId: string, orderedIds: string[], actorId: string) {
    const tenantId = requireCurrentTenantId();
    const stage = await this.prisma.funnelStage.findFirst({ where: { id: stageId, funnel: { tenantId } } });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada.");
    }

    const opportunities = await this.tenantPrisma.opportunity.findMany({ where: { stageId, deletedAt: null } });
    const validIds = new Set(opportunities.map((o) => o.id));
    const idsToReorder = orderedIds.filter((id) => validIds.has(id));
    if (idsToReorder.length !== opportunities.length) {
      throw new BadRequestException("A lista de reordenação precisa incluir todas as oportunidades desta etapa.");
    }

    await this.prisma.$transaction(
      idsToReorder.map((id, index) => this.prisma.opportunity.update({ where: { id, tenantId }, data: { ordem: index } })),
    );

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.reorder",
      entity: "FunnelStage",
      entityId: stageId,
      newData: { orderedIds: idsToReorder },
    });

    return { status: "ok" as const };
  }

  async close(id: string, dto: CloseOpportunityDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.get(id);
    if (opportunity.status !== "open") {
      throw new BadRequestException("Oportunidade já está encerrada.");
    }

    const now = new Date();
    const data: Prisma.OpportunityUncheckedUpdateInput =
      dto.resultado === "won"
        ? { status: "won", motivoGanho: dto.motivo ?? null, wonAt: now }
        : { status: "lost", motivoPerda: dto.motivo ?? null, lostAt: now };

    const updated = await this.tenantPrisma.opportunity.update({ where: { id }, data });
    await this.closeOpenStageHistory(id, now);

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: dto.resultado === "won" ? "opportunity.won" : "opportunity.lost",
      entity: "Opportunity",
      entityId: id,
      newData: { motivo: dto.motivo },
    });

    this.domainEvents.emit(dto.resultado === "won" ? "opportunity.won" : "opportunity.lost", {
      tenantId,
      contactId: opportunity.contactId,
      opportunityId: id,
      data: { opportunityId: id, motivo: dto.motivo, valor: opportunity.valor ? Number(opportunity.valor) : undefined },
    });

    // Venda concluída ou oportunidade perdida cancela follow-ups pendentes ligados a este contato.
    await this.followUps.cancelByContact(opportunity.contactId, dto.resultado === "won" ? "opportunity_won" : "opportunity_lost");

    return updated;
  }

  /** Fecha a linha de histórico "aberta" (sem exitedAt) da etapa atual — chamado ao mudar de etapa ou encerrar. */
  private async closeOpenStageHistory(opportunityId: string, at: Date = new Date()): Promise<void> {
    const open = await this.tenantPrisma.opportunityStageHistory.findFirst({
      where: { opportunityId, exitedAt: null },
      orderBy: { enteredAt: "desc" },
    });
    if (open) {
      await this.tenantPrisma.opportunityStageHistory.update({ where: { id: open.id }, data: { exitedAt: at } });
    }
  }
}
