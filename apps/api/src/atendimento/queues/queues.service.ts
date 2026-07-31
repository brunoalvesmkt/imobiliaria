import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateQueueDto } from "./dto/create-queue.dto";
import type { UpdateQueueDto } from "./dto/update-queue.dto";
import type { CreateBusinessHoursDto } from "./dto/create-business-hours.dto";

@Injectable()
export class QueuesService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.queue.findMany({ orderBy: { prioridade: "desc" } });
  }

  async get(id: string) {
    const queue = await this.tenantPrisma.queue.findFirst({ where: { id } });
    if (!queue) {
      throw new NotFoundException("Fila não encontrada.");
    }
    return queue;
  }

  async create(dto: CreateQueueDto, actorId: string) {
    const queue = await this.tenantPrisma.queue.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        teamId: dto.teamId ?? null,
        prioridade: dto.prioridade ?? 0,
        distribuicao: dto.distribuicao ?? "least_volume",
        slaMinutos: dto.slaMinutos ?? null,
        mensagemEspera: dto.mensagemEspera ?? null,
        mensagemForaExpediente: dto.mensagemForaExpediente ?? null,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "queue.create",
      entity: "Queue",
      entityId: queue.id,
      newData: { nome: queue.nome, distribuicao: queue.distribuicao },
    });

    return queue;
  }

  async update(id: string, dto: UpdateQueueDto, actorId: string) {
    await this.get(id);

    const data: Prisma.QueueUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.teamId !== undefined) data.teamId = dto.teamId;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade;
    if (dto.distribuicao !== undefined) data.distribuicao = dto.distribuicao;
    if (dto.slaMinutos !== undefined) data.slaMinutos = dto.slaMinutos;
    if (dto.mensagemEspera !== undefined) data.mensagemEspera = dto.mensagemEspera;
    if (dto.mensagemForaExpediente !== undefined) data.mensagemForaExpediente = dto.mensagemForaExpediente;

    const updated = await this.tenantPrisma.queue.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "queue.update",
      entity: "Queue",
      entityId: id,
    });

    return updated;
  }

  async addBusinessHours(queueId: string, dto: CreateBusinessHoursDto, actorId: string) {
    await this.get(queueId);

    const businessHours = await this.tenantPrisma.businessHours.create({
      data: {
        escopo: dto.escopo ?? "queue",
        queueId,
        diaSemana: dto.diaSemana ?? null,
        horaInicio: dto.horaInicio ?? null,
        horaFim: dto.horaFim ?? null,
        feriadoData: dto.feriadoData ? new Date(dto.feriadoData) : null,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "business_hours.create",
      entity: "BusinessHours",
      entityId: businessHours.id,
      newData: { queueId, diaSemana: dto.diaSemana, horaInicio: dto.horaInicio, horaFim: dto.horaFim },
    });

    return businessHours;
  }

  listBusinessHours(queueId: string) {
    return this.tenantPrisma.businessHours.findMany({ where: { queueId } });
  }

  /**
   * Sem nenhum horário configurado, a fila é considerada sempre aberta —
   * não bloqueamos atendimento por ausência de configuração (fail-open,
   * consistente com "não deixar botão sem ação"/não travar o operacional).
   */
  async isOpen(queueId: string, now: Date = new Date()): Promise<boolean> {
    const hours = await this.listBusinessHours(queueId);
    if (hours.length === 0) {
      return true;
    }

    const todayIso = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
    const currentWeekday = now.getDay();

    const holidayRecords = hours.filter((h) => h.feriadoData && h.feriadoData.toISOString().slice(0, 10) === todayIso);
    if (holidayRecords.length > 0) {
      return holidayRecords.some((h) => h.horaInicio && h.horaFim && currentTime >= h.horaInicio && currentTime <= h.horaFim);
    }

    const weekdayRecords = hours.filter((h) => h.diaSemana === currentWeekday && !h.feriadoData);
    if (weekdayRecords.length === 0) {
      return false;
    }

    return weekdayRecords.some((h) => h.horaInicio && h.horaFim && currentTime >= h.horaInicio && currentTime <= h.horaFim);
  }
}
