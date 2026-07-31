import { Module } from "@nestjs/common";
import { ProvidersModule } from "../whatsapp/providers/providers.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AiModule } from "../ai/ai.module";
import { LeadScoreConfigModule } from "../crm/lead-score-config.module";
import { FlowsController } from "./flows/flows.controller";
import { FlowsService } from "./flows/flows.service";
import { ChatbotEngineService } from "./engine/chatbot-engine.service";
import { KnowledgeBaseController } from "./knowledge-base/knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base/knowledge-base.service";

@Module({
  imports: [ProvidersModule, RealtimeModule, AiModule, LeadScoreConfigModule],
  controllers: [FlowsController, KnowledgeBaseController],
  providers: [FlowsService, ChatbotEngineService, KnowledgeBaseService],
  exports: [ChatbotEngineService],
})
export class ChatbotModule {}
