import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "../queues/redis-connection.factory";
import { ProvidersModule } from "../whatsapp/providers/providers.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AiModule } from "../ai/ai.module";
import { LeadScoreConfigModule } from "../crm/lead-score-config.module";
import { FilesModule } from "../files/files.module";
import { FlowsController } from "./flows/flows.controller";
import { FlowsService } from "./flows/flows.service";
import { ChatbotEngineService } from "./engine/chatbot-engine.service";
import { ChatbotTimeoutProducer } from "./engine/chatbot-timeout.producer";
import { ChatbotTimeoutProcessor } from "./engine/chatbot-timeout.processor";
import { KnowledgeBaseController } from "./knowledge-base/knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base/knowledge-base.service";

@Module({
  imports: [
    ProvidersModule,
    RealtimeModule,
    AiModule,
    LeadScoreConfigModule,
    FilesModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "chatbot-timeouts" }),
  ],
  controllers: [FlowsController, KnowledgeBaseController],
  providers: [FlowsService, ChatbotEngineService, ChatbotTimeoutProducer, ChatbotTimeoutProcessor, KnowledgeBaseService],
  exports: [ChatbotEngineService],
})
export class ChatbotModule {}
