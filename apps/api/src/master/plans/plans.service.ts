import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { toCsv } from "../../reports/csv.util";
import type { CreatePlanDto } from "./dto/create-plan.dto";
import type { UpdatePlanDto } from "./dto/update-plan.dto";

export interface MasterActorContext {
  actorId: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.plan.findMany({ orderBy: { createdAt: "asc" } });
  }

  async get(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException("Plano não encontrado.");
    }
    return plan;
  }

  async create(dto: CreatePlanDto, actor: MasterActorContext) {
    const existing = await this.prisma.plan.findUnique({ where: { nome: dto.nome } });
    if (existing) {
      throw new ConflictException("Já existe um plano com esse nome.");
    }

    const plan = await this.prisma.plan.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        preco: dto.preco,
        recorrencia: dto.recorrencia,
        modulos: dto.modulos,
        limites: dto.limites as Prisma.InputJsonValue,
        iaIncluida: dto.iaIncluida ?? false,
        apiOficial: dto.apiOficial ?? false,
      },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "plan.create",
      entity: "Plan",
      entityId: plan.id,
      newData: { nome: plan.nome, preco: plan.preco.toString(), modulos: dto.modulos },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, actor: MasterActorContext) {
    const before = await this.get(id);

    const data: Prisma.PlanUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.preco !== undefined) data.preco = dto.preco;
    if (dto.recorrencia !== undefined) data.recorrencia = dto.recorrencia;
    if (dto.modulos !== undefined) data.modulos = dto.modulos;
    if (dto.limites !== undefined) data.limites = dto.limites as Prisma.InputJsonValue;
    if (dto.iaIncluida !== undefined) data.iaIncluida = dto.iaIncluida;
    if (dto.apiOficial !== undefined) data.apiOficial = dto.apiOficial;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.prisma.plan.update({ where: { id }, data });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "plan.update",
      entity: "Plan",
      entityId: id,
      previousData: { nome: before.nome, preco: before.preco.toString(), ativo: before.ativo },
      newData: { nome: updated.nome, preco: updated.preco.toString(), ativo: updated.ativo },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async exportCsv(): Promise<string> {
    const plans = await this.prisma.plan.findMany({ orderBy: { createdAt: "asc" } });
    return toCsv(
      ["ID", "Nome", "Preço", "Recorrência", "Módulos", "IA incluída", "API oficial", "Ativo"],
      plans.map((p) => [
        p.id,
        p.nome,
        p.preco.toString(),
        p.recorrencia,
        Array.isArray(p.modulos) ? (p.modulos as string[]).join(";") : "",
        p.iaIncluida ? "sim" : "não",
        p.apiOficial ? "sim" : "não",
        p.ativo ? "sim" : "não",
      ]),
    );
  }
}
