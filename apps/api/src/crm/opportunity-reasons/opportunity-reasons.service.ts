import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateOpportunityReasonDto } from "./dto/create-opportunity-reason.dto";
import type { UpdateOpportunityReasonDto } from "./dto/update-opportunity-reason.dto";

@Injectable()
export class OpportunityReasonsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tipo?: "won" | "lost") {
    return this.tenantPrisma.opportunityReason.findMany({
      ...(tipo ? { where: { tipo } } : {}),
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
  }

  async get(id: string) {
    const reason = await this.tenantPrisma.opportunityReason.findFirst({ where: { id } });
    if (!reason) {
      throw new NotFoundException("Motivo não encontrado.");
    }
    return reason;
  }

  async create(dto: CreateOpportunityReasonDto, actorId: string) {
    const reason = await this.tenantPrisma.opportunityReason.create({
      data: {
        tipo: dto.tipo,
        nome: dto.nome,
        ativo: dto.ativo ?? true,
        ordem: dto.ordem ?? 0,
        obrigatorioObservacao: dto.obrigatorioObservacao ?? false,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity_reason.create",
      entity: "OpportunityReason",
      entityId: reason.id,
      newData: { tipo: reason.tipo, nome: reason.nome },
    });

    return reason;
  }

  async update(id: string, dto: UpdateOpportunityReasonDto, actorId: string) {
    await this.get(id);

    const data: Prisma.OpportunityReasonUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.obrigatorioObservacao !== undefined) data.obrigatorioObservacao = dto.obrigatorioObservacao;

    const updated = await this.tenantPrisma.opportunityReason.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity_reason.update",
      entity: "OpportunityReason",
      entityId: id,
      newData: data,
    });

    return updated;
  }

  /**
   * Sem checagem de "em uso" — o texto do motivo já fica congelado em
   * `Opportunity.motivoGanho`/`motivoPerda` no momento do fechamento,
   * independente do registro de `OpportunityReason` continuar existindo.
   */
  async remove(id: string, actorId: string) {
    await this.get(id);
    await this.tenantPrisma.opportunityReason.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity_reason.remove",
      entity: "OpportunityReason",
      entityId: id,
    });

    return { status: "ok" as const };
  }
}
