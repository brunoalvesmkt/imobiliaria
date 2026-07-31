import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { isUniqueConstraintError } from "../../prisma/prisma-error.util";
import { ProviderRegistryService } from "../providers/provider-registry.service";
import type { ParsedIncomingMessage } from "../providers/whatsapp-provider.interface";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { ChatbotEngineService } from "../../chatbot/engine/chatbot-engine.service";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { FollowUpsService } from "../../automation/followups.service";
import type { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly providers: ProviderRegistryService,
    private readonly realtime: RealtimeGateway,
    private readonly chatbotEngine: ChatbotEngineService,
    private readonly domainEvents: DomainEventsService,
    private readonly followUps: FollowUpsService,
  ) {}

  list(status?: string) {
    const where: Prisma.ConversationWhereInput = { deletedAt: null };
    if (status) where.status = status;
    return this.tenantPrisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: { whatsAppNumber: { select: { id: true, numero: true } } },
    });
  }

  async get(id: string) {
    const conversation = await this.tenantPrisma.conversation.findFirst({
      where: { id, deletedAt: null },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        queue: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada.");
    }
    return conversation;
  }

  /**
   * Ponto de entrada único para mensagens recebidas — usado tanto pelo
   * webhook real da Meta quanto pelo endpoint dev de simulação (mesma
   * lógica, mesma garantia de idempotência). Requer contexto de tenant já
   * resolvido (ALS) — o chamador é responsável por isso (ver
   * WebhooksController, que resolve o tenant pelo número antes de chamar).
   */
  async handleIncoming(whatsAppNumberId: string, parsed: ParsedIncomingMessage) {
    const existing = await this.prisma.message.findUnique({ where: { externalId: parsed.externalId } });
    if (existing) {
      return existing; // idempotência — webhook duplicado não cria mensagem duplicada (ACCEPTANCE_CRITERIA.md, caso crítico #6)
    }

    let conversation = await this.tenantPrisma.conversation.findFirst({
      where: { whatsAppNumberId, contatoNumero: parsed.fromNumero, status: { not: "closed" } },
      orderBy: { createdAt: "desc" },
    });
    const isNewConversation = !conversation;

    if (!conversation) {
      conversation = await this.tenantPrisma.conversation.create({
        data: { whatsAppNumberId, contatoNumero: parsed.fromNumero, origem: "whatsapp" },
      });
    }

    try {
      const message = await this.tenantPrisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "in",
          senderType: "contact",
          tipo: parsed.tipo,
          conteudo: parsed.conteudo ?? null,
          midiaUrl: parsed.midiaUrl ?? null,
          externalId: parsed.externalId,
        },
      });

      await this.tenantPrisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt, unreadCount: { increment: 1 } },
      });

      this.realtime.emitToTenant(requireCurrentTenantId(), "conversation:message", {
        conversationId: conversation.id,
        message,
      });

      const tenantId = requireCurrentTenantId();
      this.domainEvents.emit("message.received", {
        tenantId,
        conversationId: conversation.id,
        contactId: conversation.contactId ?? undefined,
        data: { conversationId: conversation.id, conteudo: parsed.conteudo, direction: "in" },
      });

      if (isNewConversation) {
        this.domainEvents.emit("conversation.created", {
          tenantId,
          conversationId: conversation.id,
          data: { conversationId: conversation.id, origem: conversation.origem, contatoNumero: conversation.contatoNumero },
        });
      } else {
        // Resposta do cliente cancela follow-ups pendentes desta conversa (ACCEPTANCE_CRITERIA.md, caso crítico #9).
        await this.followUps.cancelByConversation(conversation.id, "customer_replied");
      }

      await this.routeToChatbotIfApplicable(conversation.id, whatsAppNumberId, isNewConversation, parsed.conteudo ?? "");

      return message;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // corrida entre duas entregas do mesmo webhook — outra já criou a mensagem.
        return this.prisma.message.findUniqueOrThrow({ where: { externalId: parsed.externalId } });
      }
      throw error;
    }
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, actorId: string) {
    const conversation = await this.get(conversationId);
    const number = await this.prisma.whatsAppNumber.findUniqueOrThrow({ where: { id: conversation.whatsAppNumberId } });

    if (number.modalidade === "unofficial") {
      const accepted = await this.tenantPrisma.riskAcceptance.findFirst({ where: { whatsAppNumberId: number.id } });
      if (!accepted) {
        throw new ForbiddenException(
          "Aceite de risco obrigatório antes de enviar mensagens neste número (modalidade não oficial).",
        );
      }
    }

    if (conversation.contactId) {
      const contact = await this.tenantPrisma.contact.findFirst({ where: { id: conversation.contactId }, select: { bloqueado: true } });
      if (contact?.bloqueado) {
        throw new ForbiddenException("Este contato está bloqueado — desbloqueie antes de enviar mensagens.");
      }
    }

    const provider = this.providers.resolve(number.provider);
    const result = await provider.sendMessage(
      { id: number.id, tenantId: number.tenantId, numero: number.numero, externalAccountId: number.externalAccountId },
      conversation.contatoNumero,
      { tipo: dto.tipo, texto: dto.texto, midiaUrl: dto.midiaUrl },
    );

    const message = await this.tenantPrisma.message.create({
      data: {
        conversationId,
        direction: "out",
        senderType: "agent",
        tipo: dto.tipo,
        conteudo: dto.texto ?? null,
        midiaUrl: dto.midiaUrl ?? null,
        externalId: result.externalId,
        statusEntrega: "sent",
      },
    });

    await this.tenantPrisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    this.realtime.emitToTenant(requireCurrentTenantId(), "conversation:message", { conversationId, message });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "message.sent",
      entity: "Message",
      entityId: message.id,
      newData: { conversationId, tipo: dto.tipo },
    });

    return message;
  }

  /**
   * Integração Chatbot + WhatsApp (ver MODULE_DEPENDENCIES.md): se já existe
   * uma execução de fluxo em andamento nesta conversa, a resposta do
   * cliente é roteada para o motor; se é uma conversa nova e o número tem
   * um fluxo publicado configurado, o fluxo é iniciado automaticamente.
   * Sem módulo "chatbot" ativo ou sem fluxo configurado, não faz nada.
   */
  private async routeToChatbotIfApplicable(
    conversationId: string,
    whatsAppNumberId: string,
    isNewConversation: boolean,
    incomingText: string,
  ): Promise<void> {
    const tenantId = requireCurrentTenantId();
    const chatbotFlag = await this.prisma.featureFlag.findUnique({
      where: { tenantId_module: { tenantId, module: "chatbot" } },
    });
    if (!chatbotFlag?.enabled) {
      return;
    }

    const runningExecution = await this.tenantPrisma.chatbotExecution.findFirst({
      where: { conversationId, status: "running" },
      orderBy: { startedAt: "desc" },
    });

    if (runningExecution) {
      await this.chatbotEngine.handleReply(runningExecution, incomingText);
      return;
    }

    if (!isNewConversation) {
      return;
    }

    const number = await this.prisma.whatsAppNumber.findUniqueOrThrow({ where: { id: whatsAppNumberId } });
    if (!number.chatbotFlowId) {
      return;
    }

    const flow = await this.prisma.chatbotFlow.findUnique({ where: { id: number.chatbotFlowId } });
    if (!flow || flow.status !== "published") {
      return;
    }

    await this.chatbotEngine.startFlow(flow.id, conversationId);
  }
}
