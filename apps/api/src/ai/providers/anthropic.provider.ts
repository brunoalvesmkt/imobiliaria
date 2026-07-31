import { BadGatewayException, Injectable } from "@nestjs/common";
import type { AiCompletionInput, AiCompletionResult, AiProvider } from "./ai-provider.interface";

const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

/**
 * Implementação real da Anthropic Messages API. Requer uma API key válida
 * (própria do tenant ou da plataforma, resolvida por `AiAccessService`) — sem
 * ela nunca chega a chamar `complete`. Falha com uma mensagem clara em vez de
 * fingir uma resposta (mesma filosofia do MetaOfficialProvider).
 */
@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao chamar a API da Anthropic (Claude): ${errorBody}`);
    }

    const json = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((block) => block.type === "text")?.text;
    if (!text) {
      throw new BadGatewayException("Resposta da Anthropic sem conteúdo de texto.");
    }

    return { text };
  }
}
