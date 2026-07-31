import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "../queues/redis-connection.factory";
import { ProvidersModule } from "../whatsapp/providers/providers.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { ChatbotModule } from "../chatbot/chatbot.module";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationEngineService } from "./automation-engine.service";
import { AutomationProducer } from "./automation.producer";
import { AutomationProcessor } from "./automation.processor";
import { FollowUpsService } from "./followups.service";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "automations" }),
    ProvidersModule,
    RealtimeModule,
    ChatbotModule,
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    AutomationEngineService,
    AutomationProducer,
    AutomationProcessor,
    FollowUpsService,
  ],
  exports: [FollowUpsService],
})
export class AutomationModule {}
