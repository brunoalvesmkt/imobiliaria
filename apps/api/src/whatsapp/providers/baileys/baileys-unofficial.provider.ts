import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { BaileysConnectionManagerService } from "./baileys-connection-manager.service";
import type {
  ConnectResult,
  OutgoingMessageContent,
  ProviderNumberContext,
  SendMessageResult,
  WebhookParseResult,
  WhatsAppProvider,
} from "../whatsapp-provider.interface";

/**
 * Ponte real para a modalidade "conexão não oficial" — protocolo multi-device
 * do WhatsApp Web via `@whiskeysockets/baileys` (mesma família de bibliotecas
 * usada por projetos como Evolution API). Substitui o simulador em memória
 * (`FakeUnofficialProvider`, mantido para dev/CI sem depender de um telefone
 * real — ver `WHATSAPP_UNOFFICIAL_PROVIDER` no .env). Todo o estado de socket
 * vive no `BaileysConnectionManagerService`; este provedor só traduz o
 * contrato `WhatsAppProvider` para chamadas nele.
 */
@Injectable()
export class BaileysUnofficialProvider implements WhatsAppProvider {
  readonly name = "baileys_unofficial";

  constructor(
    private readonly manager: BaileysConnectionManagerService,
    private readonly prisma: PrismaService,
  ) {}

  connect(number: ProviderNumberContext): Promise<ConnectResult> {
    return this.manager.startSession(number);
  }

  getLatestQr(number: ProviderNumberContext): Promise<ConnectResult> {
    return this.manager.getLatestQr(number);
  }

  async disconnect(number: ProviderNumberContext): Promise<void> {
    await this.manager.logout(number);
  }

  async getStatus(number: ProviderNumberContext): Promise<string> {
    const inMemory = this.manager.getStatus(number.id);
    if (inMemory) return inMemory;
    const record = await this.prisma.whatsAppNumber.findUnique({ where: { id: number.id }, select: { status: true } });
    return record?.status ?? "disconnected";
  }

  sendMessage(number: ProviderNumberContext, to: string, content: OutgoingMessageContent): Promise<SendMessageResult> {
    return this.manager.sendMessage(number, to, content);
  }

  /** Não há webhook externo neste provedor — as mensagens chegam pelo socket persistente (ver BaileysConnectionManagerService). */
  verifyWebhookSignature(): boolean {
    return true;
  }

  parseWebhookPayload(): WebhookParseResult {
    return { messages: [], statusUpdates: [] };
  }
}
