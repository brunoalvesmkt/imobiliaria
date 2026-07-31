import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateFunnelDto } from "./dto/create-funnel.dto";
import type { UpdateFunnelDto } from "./dto/update-funnel.dto";
import type { CreateStageDto } from "./dto/create-stage.dto";
import type { UpdateStageDto } from "./dto/update-stage.dto";

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
    const funnel = await this.tenantPrisma.funnel.findFirst({
      where: { id },
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

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "funnel.create",
      entity: "Funnel",
      entityId: funnel.id,
      newData: { nome: funnel.nome },
    });

    return funnel;
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
}
