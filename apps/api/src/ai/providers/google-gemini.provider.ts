import { BadGatewayException, Injectable } from "@nestjs/common";
import type { AiCompletionInput, AiCompletionResult, AiEmbeddingInput, AiProvider } from "./ai-provider.interface";

const DEFAULT_MODEL = "gemini-2.0-flash";
const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Implementação real da Google Generative Language API (Gemini). A API usa
 * "model" em vez de "assistant" para o papel da resposta do próprio modelo —
 * único motivo de a request ser montada aqui em vez de reaproveitar
 * `input.messages` diretamente.
 */
@Injectable()
export class GoogleGeminiProvider implements AiProvider {
  readonly name = "google";

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    const contents = input.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${input.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(input.systemPrompt ? { systemInstruction: { parts: [{ text: input.systemPrompt }] } } : {}),
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao chamar a API do Google (Gemini): ${errorBody}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) {
      throw new BadGatewayException("Resposta do Gemini sem conteúdo de texto.");
    }

    return { text };
  }

  async embed(input: AiEmbeddingInput): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${input.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: input.text }] },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao gerar embedding via Gemini: ${errorBody}`);
    }

    const json = (await response.json()) as { embedding?: { values?: number[] } };
    const vector = json.embedding?.values;
    if (!vector) {
      throw new BadGatewayException("Resposta do Gemini sem vetor de embedding.");
    }
    return vector;
  }
}
