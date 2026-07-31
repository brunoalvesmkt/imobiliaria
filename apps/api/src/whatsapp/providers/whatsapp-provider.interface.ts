/**
 * Contrato único que qualquer provedor de WhatsApp implementa — API oficial
 * da Meta, conexão não oficial (QR Code) ou qualquer futuro adaptador. Todo
 * módulo do sistema (Atendimento, Chatbot, Automação) fala apenas com esta
 * interface, nunca com um provedor específico — ver ARCHITECTURE.md §6.
 */

export interface OutgoingMessageContent {
  tipo: "text" | "image" | "audio" | "video" | "document" | "location";
  texto?: string | undefined;
  midiaUrl?: string | undefined;
}

export interface SendMessageResult {
  externalId: string;
}

export interface ParsedIncomingMessage {
  externalId: string;
  /** Número do contato que enviou a mensagem (remetente). */
  fromNumero: string;
  /** Identificador do número da plataforma que recebeu (bate com `WhatsAppNumber.externalAccountId` ou `numero`). */
  toIdentifier: string;
  tipo: OutgoingMessageContent["tipo"];
  conteudo?: string | undefined;
  midiaUrl?: string | undefined;
  timestamp: Date;
}

export interface ParsedStatusUpdate {
  /** externalId da mensagem original enviada por nós. */
  externalId: string;
  status: "sent" | "delivered" | "read" | "failed";
}

export interface WebhookParseResult {
  messages: ParsedIncomingMessage[];
  statusUpdates: ParsedStatusUpdate[];
}

export interface ProviderNumberContext {
  id: string;
  tenantId: string;
  numero: string;
  externalAccountId: string | null;
}

export interface ConnectResult {
  status: string;
  qrCode?: string;
}

export interface WhatsAppProvider {
  readonly name: string;

  connect(number: ProviderNumberContext): Promise<ConnectResult>;
  disconnect(number: ProviderNumberContext): Promise<void>;
  getStatus(number: ProviderNumberContext): Promise<string>;
  /** Só relevante para provedores baseados em QR Code — confirma a leitura (ver FakeUnofficialProvider). */
  confirmConnection?(number: ProviderNumberContext): Promise<ConnectResult>;
  /**
   * Só relevante para provedores cujo QR Code muda sozinho até ser escaneado
   * (ex.: BaileysUnofficialProvider) — devolve o estado/QR mais recente para
   * o frontend fazer polling enquanto `status === "authenticating"`.
   */
  getLatestQr?(number: ProviderNumberContext): Promise<ConnectResult>;

  sendMessage(
    number: ProviderNumberContext,
    to: string,
    content: OutgoingMessageContent,
  ): Promise<SendMessageResult>;

  /** Valida a assinatura de um webhook recebido (ver SECURITY.md §3). */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;

  parseWebhookPayload(payload: unknown): WebhookParseResult;
}
