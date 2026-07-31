import { Injectable, NotFoundException } from "@nestjs/common";
import { AnthropicProvider } from "./anthropic.provider";
import { OpenAiProvider } from "./openai.provider";
import { GoogleGeminiProvider } from "./google-gemini.provider";
import type { AiProvider } from "./ai-provider.interface";

export const AI_PROVIDER_NAMES = ["anthropic", "openai", "google"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

@Injectable()
export class AiProviderRegistryService {
  constructor(
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAiProvider,
    private readonly google: GoogleGeminiProvider,
  ) {}

  resolve(providerName: string): AiProvider {
    switch (providerName) {
      case "anthropic":
        return this.anthropic;
      case "openai":
        return this.openai;
      case "google":
        return this.google;
      default:
        throw new NotFoundException(`Provedor de IA desconhecido: "${providerName}".`);
    }
  }
}
