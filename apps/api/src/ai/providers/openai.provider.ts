import { BadGatewayException, Injectable } from "@nestjs/common";
import type { AiCompletionInput, AiCompletionResult, AiEmbeddingInput, AiProvider } from "./ai-provider.interface";

const DEFAULT_MODEL = "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Implementação real da OpenAI Chat Completions API (ChatGPT). Mesmo
 * contrato e mesma postura de falha explícita do AnthropicProvider.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const messages = [
      ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
      ...input.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: DEFAULT_MODEL, messages }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao chamar a API da OpenAI (ChatGPT): ${errorBody}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      throw new BadGatewayException("Resposta da OpenAI sem conteúdo de texto.");
    }

    return { text };
  }

  async embed(input: AiEmbeddingInput): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: input.text }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao gerar embedding via OpenAI: ${errorBody}`);
    }

    const json = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = json.data?.[0]?.embedding;
    if (!vector) {
      throw new BadGatewayException("Resposta da OpenAI sem vetor de embedding.");
    }
    return vector;
  }
}
