/**
 * Contrato único que qualquer provedor de IA implementa — Claude (Anthropic),
 * ChatGPT (OpenAI), Gemini (Google) ou qualquer futuro adaptador. O motor do
 * Chatbot só fala com esta interface, nunca com um provedor específico
 * (mesmo padrão do WhatsAppProvider/PaymentProvider — ver ARCHITECTURE.md §6).
 */

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiCompletionInput {
  apiKey: string;
  systemPrompt?: string | undefined;
  messages: AiMessage[];
}

export interface AiCompletionResult {
  text: string;
}

export interface AiEmbeddingInput {
  apiKey: string;
  text: string;
}

export interface AiProvider {
  readonly name: string;
  complete(input: AiCompletionInput): Promise<AiCompletionResult>;
  /**
   * Vetor de embedding do texto, para busca semântica (Fase 25). Opcional —
   * a Anthropic não expõe uma API de embeddings própria; provedores sem
   * suporte simplesmente não implementam este método, e quem chama cai de
   * volta para busca por palavra-chave (ver
   * ChatbotEngineService.searchKnowledgeBase).
   */
  embed?(input: AiEmbeddingInput): Promise<number[]>;
}
