import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ConnectResult,
  OutgoingMessageContent,
  ParsedIncomingMessage,
  ParsedStatusUpdate,
  ProviderNumberContext,
  SendMessageResult,
  WebhookParseResult,
  WhatsAppProvider,
} from "./whatsapp-provider.interface";

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface MetaWebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: MetaWebhookMessage[];
        statuses?: MetaWebhookStatus[];
      };
    }>;
  }>;
}

/**
 * Implementação real da API oficial da Meta (WhatsApp Cloud API). Requer
 * `META_APP_SECRET` (assinatura de webhook) e `META_ACCESS_TOKEN` (envio)
 * configurados no `.env` — sem eles, `sendMessage` falha com uma mensagem
 * clara em vez de silenciosamente simular sucesso.
 */
@Injectable()
export class MetaOfficialProvider implements WhatsAppProvider {
  readonly name = "meta";

  constructor(private readonly config: ConfigService) {}

  async connect(): Promise<ConnectResult> {
    // Números oficiais são conectados via configuração no Meta Business
    // Manager, não por QR Code — "connect" aqui só confirma que o
    // phone_number_id está configurado.
    return { status: "connected" };
  }

  async disconnect(): Promise<void> {
    // Desconexão de número oficial é feita no Meta Business Manager, não pela nossa API.
  }

  async getStatus(number: ProviderNumberContext): Promise<string> {
    return number.externalAccountId ? "connected" : "unavailable";
  }

  async sendMessage(
    number: ProviderNumberContext,
    to: string,
    content: OutgoingMessageContent,
  ): Promise<SendMessageResult> {
    if (!number.externalAccountId) {
      throw new BadGatewayException("Número sem phone_number_id configurado.");
    }
    const accessToken = this.config.get<string>("META_ACCESS_TOKEN");
    if (!accessToken) {
      throw new BadGatewayException("META_ACCESS_TOKEN não configurado — não é possível enviar via API oficial.");
    }

    const apiVersion = this.config.get<string>("META_API_VERSION") ?? "v20.0";
    const body =
      content.tipo === "text"
        ? { messaging_product: "whatsapp", to, type: "text", text: { body: content.texto ?? "" } }
        : { messaging_product: "whatsapp", to, type: content.tipo, [content.tipo]: { link: content.midiaUrl } };

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${number.externalAccountId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao enviar via API oficial da Meta: ${errorBody}`);
    }

    const json = (await response.json()) as { messages?: Array<{ id: string }> };
    const externalId = json.messages?.[0]?.id;
    if (!externalId) {
      throw new BadGatewayException("Resposta da Meta sem id de mensagem.");
    }

    return { externalId };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    const appSecret = this.config.get<string>("META_APP_SECRET");
    if (!appSecret || !signatureHeader) {
      return false;
    }

    const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signatureHeader);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  parseWebhookPayload(payload: unknown): WebhookParseResult {
    const body = payload as MetaWebhookPayload;
    const messages: ParsedIncomingMessage[] = [];
    const statusUpdates: ParsedStatusUpdate[] = [];

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        for (const message of value?.messages ?? []) {
          if (!phoneNumberId) continue;
          messages.push({
            externalId: message.id,
            fromNumero: message.from,
            toIdentifier: phoneNumberId,
            tipo: message.type === "text" ? "text" : (message.type as ParsedIncomingMessage["tipo"]),
            conteudo: message.text?.body,
            timestamp: new Date(Number(message.timestamp) * 1000),
          });
        }

        for (const status of value?.statuses ?? []) {
          statusUpdates.push({ externalId: status.id, status: status.status });
        }
      }
    }

    return { messages, statusUpdates };
  }
}
