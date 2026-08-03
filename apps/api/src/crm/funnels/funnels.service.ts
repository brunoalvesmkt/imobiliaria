import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import type { CreateFunnelDto } from "./dto/create-funnel.dto";
import type { UpdateFunnelDto } from "./dto/update-funnel.dto";
import type { CreateStageDto } from "./dto/create-stage.dto";
import type { UpdateStageDto } from "./dto/update-stage.dto";
import { DEFAULT_FUNNEL_STAGES } from "./default-funnel.util";

@Injectable()
export class FunnelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.funnel.findMany({
      orderBy: { ordem: "asc" },
      include: { stages: { orderBy: { ordem: "asc" } } },
    });
  }

  async get(id: string) {
    // `TenantScopedPrismaService.funnel.findFirst` não é genérico o
    // suficiente pro TypeScript inferir o retorno com `include` (mesma
    // observação de contacts.service.ts) — Prisma direto, com `tenantId`
    // explícito.
    const tenantId = requireCurrentTenantId();
    const funnel = await this.prisma.funnel.findFirst({
      where: { id, tenantId },
      include: { stages: { orderBy: { ordem: "asc" } } },
    });
    if (!funnel) {
      throw new NotFoundException("Funil não encontrado.");
    }
    return funnel;
  }

  async create(dto: CreateFunnelDto, actorId: string) {
    const funnel = await this.tenantPrisma.funnel.create({
      data: { nome: dto.nome, descricao: dto.descricao ?? null, ordem: dto.ordem ?? 0 },
    });

    await this.prisma.funnelStage.createMany({
      data: DEFAULT_FUNNEL_STAGES.map((nome, ordem) => ({ funnelId: funnel.id, nome, ordem })),
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel.create",
      entity: "Funnel",
      entityId: funnel.id,
      newData: { nome: funnel.nome },
    });

    return this.get(funnel.id);
  }

  /** Duplicar funil (documento de alterações, item 11.2) — copia nome/etapas, nunca as oportunidades. */
  async duplicate(id: string, actorId: string) {
    const original = await this.get(id);

    const copy = await this.tenantPrisma.funnel.create({
      data: { nome: `${original.nome} (cópia)`, descricao: original.descricao, ordem: original.ordem },
    });

    if (original.stages.length > 0) {
      await this.prisma.funnelStage.createMany({
        data: original.stages.map((stage) => ({
          funnelId: copy.id,
          nome: stage.nome,
          ordem: stage.ordem,
          cor: stage.cor,
          probabilidade: stage.probabilidade,
          camposObrigatorios: stage.camposObrigatorios as Prisma.InputJsonValue,
          slaHoras: stage.slaHoras,
        })),
      });
    }

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel.duplicate",
      entity: "Funnel",
      entityId: copy.id,
      previousData: { originalId: id },
    });

    return this.get(copy.id);
  }

  /** Excluir funil (item 11.2) — bloqueado enquanto houver oportunidades, para não apagar histórico via cascade; a alternativa é desativar (`status: "inactive"`). */
  async remove(id: string, actorId: string) {
    await this.get(id);
    const tenantId = requireCurrentTenantId();
    const opportunitiesCount = await this.prisma.opportunity.count({ where: { tenantId, funnelId: id } });
    if (opportunitiesCount > 0) {
      throw new ConflictException(
        `Este funil tem ${opportunitiesCount} oportunidade(s) vinculada(s). Desative o funil em vez de excluir, para não perder o histórico.`,
      );
    }

    await this.prisma.funnel.delete({ where: { id, tenantId } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "funnel.remove", entity: "Funnel", entityId: id });

    return { status: "ok" as const };
  }

  async update(id: string, dto: UpdateFunnelDto, actorId: string) {
    await this.get(id);

    const data: Prisma.FunnelUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.tenantPrisma.funnel.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel.update",
      entity: "Funnel",
      entityId: id,
      newData: { nome: updated.nome, status: updated.status },
    });

    return updated;
  }

  async addStage(funnelId: string, dto: CreateStageDto, actorId: string) {
    await this.get(funnelId); // garante que o funil pertence ao tenant autenticado

    const stage = await this.prisma.funnelStage.create({
      data: {
        funnelId,
        nome: dto.nome,
        ordem: dto.ordem,
        cor: dto.cor ?? null,
        probabilidade: dto.probabilidade ?? null,
        ...(dto.camposObrigatorios !== undefined
          ? { camposObrigatorios: dto.camposObrigatorios as Prisma.InputJsonValue }
          : {}),
        slaHoras: dto.slaHoras ?? null,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel_stage.create",
      entity: "FunnelStage",
      entityId: stage.id,
      newData: { nome: stage.nome, funnelId },
    });

    return stage;
  }

  async updateStage(funnelId: string, stageId: string, dto: UpdateStageDto, actorId: string) {
    await this.get(funnelId);

    const stage = await this.prisma.funnelStage.findFirst({ where: { id: stageId, funnelId } });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const data: Prisma.FunnelStageUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.cor !== undefined) data.cor = dto.cor;
    if (dto.probabilidade !== undefined) data.probabilidade = dto.probabilidade;
    if (dto.camposObrigatorios !== undefined) data.camposObrigatorios = dto.camposObrigatorios as Prisma.InputJsonValue;
    if (dto.slaHoras !== undefined) data.slaHoras = dto.slaHoras;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.prisma.funnelStage.update({ where: { id: stageId }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel_stage.update",
      entity: "FunnelStage",
      entityId: stageId,
      newData: { nome: updated.nome, ativo: updated.ativo },
    });

    return updated;
  }

  /** Excluir etapa (item 11.4) — exige `targetStageId` quando houver oportunidades nela ("exigir a seleção de outra etapa de destino"). */
  async removeStage(funnelId: string, stageId: string, targetStageId: string | undefined, actorId: string) {
    await this.get(funnelId);
    const stage = await this.prisma.funnelStage.findFirst({ where: { id: stageId, funnelId } });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const tenantId = requireCurrentTenantId();
    const opportunitiesCount = await this.prisma.opportunity.count({ where: { tenantId, stageId } });

    if (opportunitiesCount > 0) {
      if (!targetStageId) {
        throw new ConflictException({
          message: `Esta etapa tem ${opportunitiesCount} oportunidade(s). Selecione uma etapa de destino para continuar.`,
          opportunitiesCount,
        });
      }
      if (targetStageId === stageId) {
        throw new ConflictException("A etapa de destino deve ser diferente da etapa removida.");
      }
      const target = await this.prisma.funnelStage.findFirst({ where: { id: targetStageId, funnelId } });
      if (!target) {
        throw new NotFoundException("Etapa de destino não encontrada neste funil.");
      }
      await this.prisma.opportunity.updateMany({ where: { tenantId, stageId }, data: { stageId: targetStageId } });
    }

    await this.prisma.funnelStage.delete({ where: { id: stageId } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel_stage.remove",
      entity: "FunnelStage",
      entityId: stageId,
      previousData: { targetStageId: targetStageId ?? null },
    });

    return { status: "ok" as const };
  }

  /**
   * Transferir oportunidade entre funis (item 11.5) — move para a
   * primeira etapa do funil de destino (não faz sentido preservar a
   * posição de etapa entre funis com estruturas diferentes). A parte de
   * "perder acesso ao lead se não tiver acesso ao novo funil" depende de
   * controle de acesso por funil, que este RBAC (por módulo, não por
   * funil) ainda não modela — registrado como pendência no relatório
   * final; o histórico da movimentação fica na auditoria de qualquer forma.
   */
  async transferOpportunity(opportunityId: string, targetFunnelId: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
    if (!opportunity) {
      throw new NotFoundException("Oportunidade não encontrada.");
    }
    const targetFunnel = await this.get(targetFunnelId);
    const firstStage = targetFunnel.stages[0];
    if (!firstStage) {
      throw new ConflictException("O funil de destino não tem etapas.");
    }

    const updated = await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { funnelId: targetFunnelId, stageId: firstStage.id },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.transfer_funnel",
      entity: "Opportunity",
      entityId: opportunityId,
      previousData: { funnelId: opportunity.funnelId, stageId: opportunity.stageId },
      newData: { funnelId: targetFunnelId, stageId: firstStage.id },
    });

    return updated;
  }
}
