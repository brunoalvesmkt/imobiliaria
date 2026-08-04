import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import type { CreateTaskDto } from "./dto/create-task.dto";
import type { UpdateTaskDto } from "./dto/update-task.dto";

@Injectable()
export class CrmTasksService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  /**
   * `view` implementa os atalhos do documento (item 12): "hoje" é o filtro
   * inicial ao abrir Tarefas; "atrasadas"/"futuras" recortam por `dataHora`
   * relativa a agora; "periodo" usa `dataInicio`/`dataFim` explícitos;
   * "todas" não recorta por data.
   */
  list(params: {
    contactId?: string | undefined;
    opportunityId?: string | undefined;
    responsavelId?: string | undefined;
    status?: string | undefined;
    view?: "hoje" | "atrasadas" | "futuras" | "todas" | "periodo" | undefined;
    dataInicio?: string | undefined;
    dataFim?: string | undefined;
    tipo?: string | undefined;
  }) {
    const { contactId, opportunityId, responsavelId, status, view, dataInicio, dataFim, tipo } = params;
    const where: Prisma.CrmTaskWhereInput = {};
    if (contactId) where.contactId = contactId;
    if (opportunityId) where.opportunityId = opportunityId;
    if (responsavelId) where.responsavelId = responsavelId;
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;

    const now = new Date();
    switch (view) {
      case "hoje": {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        where.dataHora = { gte: start, lt: end };
        break;
      }
      case "atrasadas":
        where.dataHora = { lt: now };
        // Tarefas vencidas viram status "overdue" via CrmTasksOverdueScheduler (roda de hora em
        // hora) — sem isso aqui, a view "Atrasadas" ficava restrita a "pending" e escondia toda
        // tarefa que o scheduler já tinha marcado como vencida. Só força quando o usuário não
        // escolheu um status explícito no Filtro (linha 39 acima já teria aplicado `where.status`).
        if (!status) where.status = { not: "done" };
        break;
      case "futuras":
        where.dataHora = { gt: now };
        break;
      case "periodo":
        where.dataHora = {
          ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
          ...(dataFim ? { lte: new Date(dataFim) } : {}),
        };
        break;
      case "todas":
      default:
        break;
    }

    return this.tenantPrisma.crmTask.findMany({ where, orderBy: { dataHora: "asc" } });
  }

  async get(id: string) {
    const task = await this.tenantPrisma.crmTask.findFirst({ where: { id } });
    if (!task) {
      throw new NotFoundException("Tarefa não encontrada.");
    }
    return task;
  }

  async create(dto: CreateTaskDto, actorId: string) {
    const contact = await this.tenantPrisma.contact.findFirst({ where: { id: dto.contactId, deletedAt: null } });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }

    if (dto.opportunityId) {
      const opportunity = await this.tenantPrisma.opportunity.findFirst({
        where: { id: dto.opportunityId, deletedAt: null },
      });
      if (!opportunity) {
        throw new NotFoundException("Oportunidade não encontrada.");
      }
    }

    const task = await this.tenantPrisma.crmTask.create({
      data: {
        contactId: dto.contactId,
        opportunityId: dto.opportunityId ?? null,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descricao: dto.descricao ?? null,
        dataHora: new Date(dto.dataHora),
        responsavelId: dto.responsavelId ?? null,
        status: "pending",
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "crm_task.create",
      entity: "CrmTask",
      entityId: task.id,
      newData: { titulo: task.titulo, contactId: task.contactId },
    });

    this.domainEvents.emit("crm_task.created", {
      tenantId: requireCurrentTenantId(),
      contactId: task.contactId,
      data: { taskId: task.id, tipo: task.tipo, titulo: task.titulo },
    });

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string) {
    const before = await this.get(id);

    const data: Prisma.CrmTaskUncheckedUpdateInput = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.dataHora !== undefined) data.dataHora = new Date(dto.dataHora);
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.status !== undefined) {
      data.status = dto.status;
      data.concluidaEm = dto.status === "done" ? new Date() : null;
    }

    const updated = await this.tenantPrisma.crmTask.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "crm_task.update",
      entity: "CrmTask",
      entityId: id,
      previousData: { status: before.status },
      newData: { status: updated.status },
    });

    return updated;
  }
}
