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
import { AutomationDataTriggersScheduler } from "./automation-data-triggers.scheduler";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "automations" }),
    BullModule.registerQueue({ name: "automation-data-triggers" }),
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
    AutomationDataTriggersScheduler,
  ],
  exports: [FollowUpsService],
})
export class AutomationModule {}
