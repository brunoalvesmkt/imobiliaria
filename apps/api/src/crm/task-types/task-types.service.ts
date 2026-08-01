import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateTaskTypeDto } from "./dto/create-task-type.dto";
import type { UpdateTaskTypeDto } from "./dto/update-task-type.dto";

/** Tipos de tarefa personalizáveis do CRM > Tarefas — complementam os tipos padrão fixos no frontend. */
@Injectable()
export class TaskTypesService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.crmTaskType.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  }

  private async get(id: string) {
    const type = await this.tenantPrisma.crmTaskType.findFirst({ where: { id } });
    if (!type) {
      throw new NotFoundException("Tipo de tarefa não encontrado.");
    }
    return type;
  }

  async create(dto: CreateTaskTypeDto, actorId: string) {
    const existing = await this.tenantPrisma.crmTaskType.findFirst({ where: { nome: dto.nome } });
    if (existing) {
      throw new ConflictException("Já existe um tipo de tarefa com esse nome.");
    }

    const type = await this.tenantPrisma.crmTaskType.create({ data: { nome: dto.nome } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "crm_task_type.create", entity: "CrmTaskType", entityId: type.id, newData: { nome: type.nome } });

    return type;
  }

  async update(id: string, dto: UpdateTaskTypeDto, actorId: string) {
    await this.get(id);

    const type = await this.tenantPrisma.crmTaskType.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.ordem !== undefined ? { ordem: dto.ordem } : {}),
      },
    });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "crm_task_type.update", entity: "CrmTaskType", entityId: id });

    return type;
  }

  /** Bloqueia a exclusão enquanto houver tarefas usando o tipo (sem substituição automática — o tipo é só um rótulo). */
  async remove(id: string, actorId: string) {
    const type = await this.get(id);
    const tasksUsing = await this.tenantPrisma.crmTask.count({ where: { tipo: type.nome } });
    if (tasksUsing > 0) {
      throw new ConflictException(`Este tipo está em uso por ${tasksUsing} tarefa(s). Altere o tipo dessas tarefas antes de excluir.`);
    }

    await this.tenantPrisma.crmTaskType.delete({ where: { id } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "crm_task_type.remove", entity: "CrmTaskType", entityId: id });

    return { status: "ok" as const };
  }
}
