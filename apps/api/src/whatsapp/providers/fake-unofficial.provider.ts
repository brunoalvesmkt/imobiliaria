import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ConnectResult,
  OutgoingMessageContent,
  ParsedIncomingMessage,
  ProviderNumberContext,
  SendMessageResult,
  WebhookParseResult,
  WhatsAppProvider,
} from "./whatsapp-provider.interface";

interface SimulatedIncomingPayload {
  fromNumero: string;
  tipo?: OutgoingMessageContent["tipo"];
  conteudo?: string;
  midiaUrl?: string;
}

/**
 * Provedor de desenvolvimento para a modalidade "conexão não oficial".
 *
 * Uma ponte real (ex.: Baileys/whatsapp-web.js falando com o WhatsApp Web)
 * exige um número de telefone físico e uma sessão de navegador persistente
 * — inviável de operar de forma confiável neste ambiente. Este provedor
 * implementa o mesmo contrato (`WhatsAppProvider`) com um simulador em
 * memória: gera um "QR Code" fake, confirma a conexão sob demanda, e
 * aceita mensagens de entrada simuladas via endpoint dev-only autenticado
 * (`POST /whatsapp/numbers/:id/dev/simulate-incoming`). Troca por uma ponte
 * real é feita implementando a mesma interface, sem tocar no resto do
 * sistema — essa é a razão de existir da abstração de provedores (ver
 * ARCHITECTURE.md §6).
 */
@Injectable()
export class FakeUnofficialProvider implements WhatsAppProvider {
  readonly name = "fake_unofficial";

  private readonly connectionState = new Map<string, string>();

  async connect(number: ProviderNumberContext): Promise<ConnectResult> {
    this.connectionState.set(number.id, "authenticating");
    return { status: "authenticating", qrCode: `fake-qr:${number.id}:${randomUUID()}` };
  }

  async confirmConnection(number: ProviderNumberContext): Promise<ConnectResult> {
    this.connectionState.set(number.id, "connected");
    return { status: "connected" };
  }

  async disconnect(number: ProviderNumberContext): Promise<void> {
    this.connectionState.set(number.id, "disconnected");
  }

  async getStatus(number: ProviderNumberContext): Promise<string> {
    return this.connectionState.get(number.id) ?? "disconnected";
  }

  async sendMessage(
    number: ProviderNumberContext,
    _to: string,
    _content: OutgoingMessageContent,
  ): Promise<SendMessageResult> {
    const status = this.connectionState.get(number.id) ?? "disconnected";
    if (status !== "connected") {
      throw new Error("Número não está conectado — escaneie o QR Code antes de enviar mensagens.");
    }
    return { externalId: `fake-msg-${randomUUID()}` };
  }

  /**
   * Sem assinatura real (não há webhook externo de verdade nesta
   * implementação) — o endpoint que injeta mensagens simuladas já exige
   * autenticação de tenant normal, então a validação de payload aqui é
   * apenas estrutural, não criptográfica.
   */
  verifyWebhookSignature(): boolean {
    return true;
  }

  parseWebhookPayload(payload: unknown): WebhookParseResult {
    const data = payload as SimulatedIncomingPayload;
    const message: ParsedIncomingMessage = {
      externalId: `fake-in-${randomUUID()}`,
      fromNumero: data.fromNumero,
      toIdentifier: "", // preenchido pelo chamador, que já sabe o whatsAppNumberId (não veio de um webhook real)
      tipo: data.tipo ?? "text",
      conteudo: data.conteudo,
      midiaUrl: data.midiaUrl,
      timestamp: new Date(),
    };
    return { messages: [message], statusUpdates: [] };
  }
}
