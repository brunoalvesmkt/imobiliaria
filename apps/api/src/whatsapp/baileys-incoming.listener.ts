import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { tenantContextStorage } from "../common/tenant/tenant-context";
import { ConversationsService } from "./conversations/conversations.service";
import { BAILEYS_INCOMING_EVENT, type BaileysIncomingEventPayload } from "./providers/baileys/baileys-connection-manager.service";

/**
 * Ponte entre o socket Baileys (evento interno, fora de qualquer request
 * HTTP) e o pipeline de conversas — equivalente ao que o `WebhooksController`
 * faz para a Meta, mas disparado por um evento em vez de uma chamada HTTP.
 * Vive no `WhatsappModule` (não em `ProvidersModule`) porque só aqui
 * `ConversationsService` já está disponível sem criar um import circular
 * entre módulos.
 */
@Injectable()
export class BaileysIncomingListener implements OnModuleInit {
  private readonly logger = new Logger(BaileysIncomingListener.name);

  constructor(
    private readonly events: EventEmitter2,
    private readonly conversations: ConversationsService,
  ) {}

  onModuleInit(): void {
    this.events.on(BAILEYS_INCOMING_EVENT, (payload: BaileysIncomingEventPayload) => {
      tenantContextStorage
        .run(
          { tenantId: payload.tenantId, actor: { actorId: "system:whatsapp-baileys", actorType: "tenant_user" } },
          () => this.conversations.handleIncoming(payload.numberId, payload.message),
        )
        // Sem isso, uma falha aqui (ex.: erro ao casar/iniciar o fluxo do chatbot) virava uma
        // unhandled rejection silenciosa — a mensagem chegava na conversa, mas nada explicava
        // por que o fluxo não iniciou. Agora fica registrado com o número e o texto recebido.
        .catch((error) =>
          this.logger.error(
            `Falha ao processar mensagem recebida via Baileys (número ${payload.numberId}): ${(error as Error).message}`,
            (error as Error).stack,
          ),
        );
    });
  }
}
