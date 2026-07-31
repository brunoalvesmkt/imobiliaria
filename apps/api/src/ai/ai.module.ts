import { Module } from "@nestjs/common";
import { AnthropicProvider } from "./providers/anthropic.provider";
import { OpenAiProvider } from "./providers/openai.provider";
import { GoogleGeminiProvider } from "./providers/google-gemini.provider";
import { AiProviderRegistryService } from "./providers/ai-provider-registry.service";
import { AiAccessService } from "./ai-access.service";
import { AiSettingsController } from "./ai-settings.controller";
import { MasterAiSettingsController } from "./master-ai-settings.controller";

@Module({
  controllers: [AiSettingsController, MasterAiSettingsController],
  providers: [AnthropicProvider, OpenAiProvider, GoogleGeminiProvider, AiProviderRegistryService, AiAccessService],
  exports: [AiProviderRegistryService, AiAccessService],
})
export class AiModule {}
