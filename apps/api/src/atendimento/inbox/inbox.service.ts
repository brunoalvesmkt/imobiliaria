import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { FollowUpsService } from "../../automation/followups.service";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { SummaryService } from "./summary.service";
import { QueueDistributionService } from "../queues/queue-distribution.service";
import type { AssignQueueDto } from "./dto/assign-queue.dto";
import type { TransferDto } from "./dto/transfer.dto";

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly summary: SummaryService,
    private readonly realtime: RealtimeGateway,
    private readonly followUps: FollowUpsService,
    private readonly domainEvents: DomainEventsService,
    private readonly distribution: QueueDistributionService,
  ) {}

  private notify(conversationId: string): void {
    this.realtime.emitToTenant(requireCurrentTenantId(), "conversation:updated", { conversationId });
  }

  list(status?: string, queueId?: string, responsavelId?: string) {
    return this.tenantPrisma.conversation.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(queueId ? { queueId } : {}),
        ...(responsavelId ? { responsavelId } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        whatsAppNumber: { select: { id: true, numero: true } },
        queue: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
  }

  private async getConversation(id: string) {
    const conversation = await this.tenantPrisma.conversation.findFirst({ where: { id, deletedAt: null } });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada.");
    }
    return conversation;
  }

  async assignToQueue(conversationId: string, dto: AssignQueueDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.getConversation(conversationId);

    const queue = await this.tenantPrisma.queue.findFirst({ where: { id: dto.queueId } });
    if (!queue) {
      throw new NotFoundException("Fila não encontrada.");
    }

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { queueId: dto.queueId },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "assign", actorId, payload: { queueId: dto.queueId } },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.assign_queue",
      entity: "Conversation",
      entityId: conversationId,
      tenantId,
      newData: { queueId: dto.queueId },
    });

    this.notify(conversationId);
    return updated;
  }

  /** Distribuição automática — aplica a estratégia configurada na fila atual da conversa. */
  async autoAssign(conversationId: string, actorId: string) {
    const conversation = await this.getConversation(conversationId);
    if (!conversation.queueId) {
      throw new BadRequestException("Conversa não está em nenhuma fila — atribua uma fila antes de distribuir.");
    }

    const nextMemberId = await this.distribution.pickNextMember(conversation.queueId);
    if (!nextMemberId) {
      throw new BadRequestException("Nenhum atendente disponível na equipe desta fila.");
    }

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { responsavelId: nextMemberId },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "assign", actorId, payload: { responsavelId: nextMemberId, automatico: true } },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.auto_assign",
      entity: "Conversation",
      entityId: conversationId,
      newData: { responsavelId: nextMemberId },
    });

    this.notify(conversationId);
    return updated;
  }

  /**
   * "Assumir" — o próprio atendente pega a conversa para si. Fase 54
   * (controle de concorrência): se a conversa já tem outro responsável,
   * recusa por padrão (409) em vez de sobrescrever silenciosamente — dois
   * atendentes clicando "assumir" quase ao mesmo tempo não podem os dois
   * achar que estão com a conversa. `force=true` permite a sobrescrita
   * deliberada (ex.: supervisor reatribuindo).
   */
  async assume(conversationId: string, actorId: string, force = false) {
    const conversation = await this.getConversation(conversationId);
    if (conversation.responsavelId && conversation.responsavelId !== actorId && !force) {
      const current = await this.prisma.tenantUser.findUnique({
        where: { id: conversation.responsavelId },
        select: { id: true, nome: true },
      });
      throw new ConflictException({
        message: `Esta conversa já está sendo atendida por ${current?.nome ?? "outro atendente"}.`,
        responsavelId: conversation.responsavelId,
        responsavelNome: current?.nome ?? null,
      });
    }

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { responsavelId: actorId },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "assign", actorId, payload: { responsavelId: actorId, assumidoManualmente: true } },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.assume",
      entity: "Conversation",
      entityId: conversationId,
    });

    this.notify(conversationId);
    return updated;
  }

  /** "Devolver para fila" — remove o responsável, mantém a fila. */
  async returnToQueue(conversationId: string, actorId: string) {
    await this.getConversation(conversationId);

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { responsavelId: null },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "assign", actorId, payload: { responsavelId: null } },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.return_to_queue",
      entity: "Conversation",
      entityId: conversationId,
    });

    this.notify(conversationId);
    return updated;
  }

  /**
   * Transferência com geração de resumo estruturado (seção 9.7 do prompt
   * mestre — como não há API oficial garantindo contexto nativo entre
   * atendentes nesta fase, o resumo é sempre gerado e anexado ao evento).
   */
  async transfer(conversationId: string, dto: TransferDto, actorId: string) {
    if (!dto.tenantUserId && !dto.queueId && !dto.teamId) {
      throw new BadRequestException("Informe tenantUserId, queueId ou teamId para transferir.");
    }

    await this.getConversation(conversationId);
    const summary = await this.summary.generate(conversationId);

    // Conversation não tem campo de equipe próprio — transferir "para uma equipe" resolve para a
    // fila de maior prioridade dessa equipe e deixa a distribuição normal da fila decidir o
    // atendente (mesmo mecanismo de pickNextMember usado no auto-assign).
    let queueId = dto.queueId;
    if (dto.teamId) {
      const teamQueue = await this.tenantPrisma.queue.findFirst({
        where: { teamId: dto.teamId, ativo: true },
        orderBy: { prioridade: "desc" },
      });
      if (!teamQueue) {
        throw new BadRequestException("Esta equipe não tem nenhuma fila ativa para receber a transferência.");
      }
      queueId = teamQueue.id;
    }

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: {
        responsavelId: dto.tenantUserId ?? null,
        ...(queueId ? { queueId } : {}),
      },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: {
        conversationId,
        tipo: "transfer",
        actorId,
        payload: { para: dto.tenantUserId ?? queueId, resumo: summary.texto },
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.transfer",
      entity: "Conversation",
      entityId: conversationId,
      newData: { tenantUserId: dto.tenantUserId, queueId },
    });

    this.domainEvents.emit("conversation.transferred", {
      tenantId: requireCurrentTenantId(),
      conversationId,
      contactId: updated.contactId ?? undefined,
      data: { conversationId, responsavelId: dto.tenantUserId ?? null, queueId: queueId ?? null },
    });

    this.notify(conversationId);
    return { conversation: updated, resumo: summary.texto };
  }

  async close(conversationId: string, actorId: string) {
    await this.getConversation(conversationId);

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { status: "closed" },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "close", actorId },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.close",
      entity: "Conversation",
      entityId: conversationId,
    });

    // Atendimento encerrado cancela follow-ups pendentes desta conversa (ACCEPTANCE_CRITERIA.md, caso crítico #9).
    await this.followUps.cancelByConversation(conversationId, "conversation_closed");

    this.domainEvents.emit("conversation.closed", {
      tenantId: requireCurrentTenantId(),
      conversationId,
      contactId: updated.contactId ?? undefined,
      data: { conversationId },
    });

    this.notify(conversationId);
    return updated;
  }

  async reopen(conversationId: string, actorId: string) {
    await this.getConversation(conversationId);

    const updated = await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { status: "open" },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: { conversationId, tipo: "reopen", actorId },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.reopen",
      entity: "Conversation",
      entityId: conversationId,
    });

    this.notify(conversationId);
    return updated;
  }
}
