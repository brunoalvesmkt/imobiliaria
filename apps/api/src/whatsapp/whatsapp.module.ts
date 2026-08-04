import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { ChatbotModule } from "../chatbot/chatbot.module";
import { AutomationModule } from "../automation/automation.module";
import { PlatformSettingsModule } from "../master/settings/platform-settings.module";
import { ProvidersModule } from "./providers/providers.module";
import { NumbersController } from "./numbers/numbers.controller";
import { NumbersService } from "./numbers/numbers.service";
import { NumberFlowsService } from "./numbers/number-flows.service";
import { ConversationsController } from "./conversations/conversations.controller";
import { ConversationsService } from "./conversations/conversations.service";
import { TemplatesController } from "./templates/templates.controller";
import { TemplatesService } from "./templates/templates.service";
import { WebhooksController } from "./webhooks/webhooks.controller";
import { BaileysIncomingListener } from "./baileys-incoming.listener";

@Module({
  imports: [ProvidersModule, RealtimeModule, ChatbotModule, AutomationModule, PlatformSettingsModule],
  controllers: [NumbersController, ConversationsController, TemplatesController, WebhooksController],
  providers: [NumbersService, NumberFlowsService, ConversationsService, TemplatesService, BaileysIncomingListener],
  exports: [ConversationsService],
})
export class WhatsappModule {}
