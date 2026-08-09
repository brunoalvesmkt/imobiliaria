import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateStageChecklistItemDto } from "./dto/create-stage-checklist-item.dto";
import type { UpdateStageChecklistItemDto } from "./dto/update-stage-checklist-item.dto";
import type { ChecklistAnswerDto } from "./dto/checklist-answer.dto";
import type { UpdateChecklistProgressDto } from "./dto/update-checklist-progress.dto";

/**
 * Roteiros de Etapas — checklist configurável por etapa do funil que
 * bloqueia a movimentação MANUAL de uma oportunidade até que todos os itens
 * ativos tenham alguma resposta. `enforceStageChecklist` é chamado por
 * `OpportunitiesService.moveStage` antes de efetivar a troca de etapa.
 */
@Injectable()
export class StageChecklistsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  listItems(stageId: string) {
    return this.tenantPrisma.stageChecklistItem.findMany({ where: { stageId }, orderBy: [{ ordem: "asc" }] });
  }

  async createItem(dto: CreateStageChecklistItemDto, actorId: string) {
    const item = await this.tenantPrisma.stageChecklistItem.create({
      data: {
        stageId: dto.stageId,
        titulo: dto.titulo,
        ordem: dto.ordem ?? 0,
        obrigatorioMotivo: dto.obrigatorioMotivo ?? false,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "stage_checklist_item.create",
      entity: "StageChecklistItem",
      entityId: item.id,
      newData: { stageId: item.stageId, titulo: item.titulo },
    });

    return item;
  }

  async updateItem(id: string, dto: UpdateStageChecklistItemDto, actorId: string) {
    const existing = await this.tenantPrisma.stageChecklistItem.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Item de roteiro não encontrado.");
    }

    const data: Prisma.StageChecklistItemUncheckedUpdateInput = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    if (dto.obrigatorioMotivo !== undefined) data.obrigatorioMotivo = dto.obrigatorioMotivo;

    const updated = await this.tenantPrisma.stageChecklistItem.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "stage_checklist_item.update",
      entity: "StageChecklistItem",
      entityId: id,
      newData: { titulo: dto.titulo, ordem: dto.ordem, ativo: dto.ativo, obrigatorioMotivo: dto.obrigatorioMotivo },
    });

    return updated;
  }

  async deleteItem(id: string, actorId: string) {
    const existing = await this.tenantPrisma.stageChecklistItem.findFirst({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Item de roteiro não encontrado.");
    }
    await this.tenantPrisma.stageChecklistItem.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "stage_checklist_item.remove",
      entity: "StageChecklistItem",
      entityId: id,
    });

    return { status: "ok" as const };
  }

  getHistory(opportunityId: string) {
    return this.tenantPrisma.opportunityStageChecklistFill.findMany({
      where: { opportunityId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Itens ativos da etapa ATUAL da oportunidade + resposta já salva (progresso mutável), se houver. */
  async getProgress(opportunityId: string) {
    const opportunity = await this.tenantPrisma.opportunity.findFirst({ where: { id: opportunityId } });
    if (!opportunity) {
      throw new NotFoundException("Oportunidade não encontrada.");
    }

    const [items, progress] = await Promise.all([
      this.tenantPrisma.stageChecklistItem.findMany({ where: { stageId: opportunity.stageId, ativo: true }, orderBy: [{ ordem: "asc" }] }),
      this.tenantPrisma.opportunityChecklistProgress.findMany({ where: { opportunityId } }),
    ]);
    const progressByItem = new Map(progress.map((p) => [p.itemId, p]));

    return items.map((item) => ({
      item,
      resultado: progressByItem.get(item.id)?.resultado ?? null,
      motivo: progressByItem.get(item.id)?.motivo ?? null,
    }));
  }

  async updateProgress(opportunityId: string, dto: UpdateChecklistProgressDto, actorId: string) {
    const opportunity = await this.tenantPrisma.opportunity.findFirst({ where: { id: opportunityId } });
    if (!opportunity) {
      throw new NotFoundException("Oportunidade não encontrada.");
    }

    const item = await this.tenantPrisma.stageChecklistItem.findFirst({ where: { id: dto.itemId, stageId: opportunity.stageId } });
    if (!item) {
      throw new NotFoundException("Item de roteiro não pertence à etapa atual da oportunidade.");
    }
    if (dto.resultado === "nao_concluido" && item.obrigatorioMotivo && !dto.motivo?.trim()) {
      throw new BadRequestException(`O item "${item.titulo}" exige um motivo quando não concluído.`);
    }

    const progress = await this.tenantPrisma.opportunityChecklistProgress.upsert({
      opportunityId,
      itemId: dto.itemId,
      stageId: opportunity.stageId,
      create: { resultado: dto.resultado, motivo: dto.motivo ?? null },
      update: { resultado: dto.resultado, motivo: dto.motivo ?? null },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity_checklist_progress.update",
      entity: "OpportunityChecklistProgress",
      entityId: progress.id,
      newData: { opportunityId, itemId: dto.itemId, resultado: dto.resultado },
    });

    return progress;
  }

  /**
   * Chamado por `OpportunitiesService.moveStage` antes de efetivar a troca
   * de etapa. Sem itens ativos na etapa de origem, não valida nada. Com
   * itens, exige resposta para TODOS (via `checklist` explícito no corpo do
   * PATCH, ou como fallback os valores já salvos em
   * `OpportunityChecklistProgress` — ver bloco de roteiro marcável na
   * ficha). Grava o snapshot IMUTÁVEL (título congelado, não referência
   * viva ao item) antes de retornar, e limpa o progresso da etapa de
   * origem, que não serve mais depois de sair dela.
   */
  async enforceStageChecklist(
    opportunityId: string,
    stageIdOrigem: string,
    checklist: ChecklistAnswerDto[] | undefined,
    actorId: string,
  ): Promise<void> {
    const activeItems = await this.tenantPrisma.stageChecklistItem.findMany({ where: { stageId: stageIdOrigem, ativo: true } });
    if (activeItems.length === 0) return;

    let answers: { itemId: string; resultado: "concluido" | "nao_concluido"; motivo?: string | undefined }[];
    if (checklist !== undefined) {
      answers = checklist;
    } else {
      const progress = await this.tenantPrisma.opportunityChecklistProgress.findMany({
        where: { opportunityId, stageId: stageIdOrigem },
      });
      answers = progress
        .filter((p): p is typeof p & { resultado: string } => p.resultado != null)
        .map((p) => ({ itemId: p.itemId, resultado: p.resultado as "concluido" | "nao_concluido", motivo: p.motivo ?? undefined }));
    }

    const answersByItem = new Map(answers.map((a) => [a.itemId, a]));
    const pending: string[] = [];
    for (const item of activeItems) {
      const answer = answersByItem.get(item.id);
      if (!answer) {
        pending.push(item.titulo);
        continue;
      }
      if (answer.resultado === "nao_concluido" && item.obrigatorioMotivo && !answer.motivo?.trim()) {
        throw new BadRequestException(`O item "${item.titulo}" exige um motivo quando não concluído.`);
      }
    }
    if (pending.length > 0) {
      throw new BadRequestException(`Responda o roteiro da etapa antes de mover: ${pending.join(", ")}.`);
    }

    const snapshotItens = activeItems.map((item) => {
      const answer = answersByItem.get(item.id)!;
      return { itemId: item.id, titulo: item.titulo, resultado: answer.resultado, motivo: answer.motivo ?? null };
    });

    await this.tenantPrisma.opportunityStageChecklistFill.create({
      data: {
        opportunityId,
        stageId: stageIdOrigem,
        preenchidoPor: actorId,
        itens: snapshotItens as unknown as Prisma.InputJsonValue,
      },
    });

    await this.tenantPrisma.opportunityChecklistProgress.deleteMany({ where: { opportunityId, stageId: stageIdOrigem } });
  }
}
