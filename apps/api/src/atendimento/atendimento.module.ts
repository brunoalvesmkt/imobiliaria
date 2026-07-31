import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { AutomationModule } from "../automation/automation.module";
import { AiModule } from "../ai/ai.module";
import { TeamsController } from "./teams/teams.controller";
import { TeamsService } from "./teams/teams.service";
import { QueuesController } from "./queues/queues.controller";
import { QueuesService } from "./queues/queues.service";
import { InboxController } from "./inbox/inbox.controller";
import { InboxService } from "./inbox/inbox.service";
import { SummaryService } from "./inbox/summary.service";
import { QualityController } from "./quality/quality.controller";
import { QualityService } from "./quality/quality.service";
import { QualityConfigController } from "./quality/quality-config.controller";
import { QualityConfigService } from "./quality/quality-config.service";
import { QuickMessagesController } from "./quick-messages/quick-messages.controller";
import { QuickMessagesService } from "./quick-messages/quick-messages.service";

@Module({
  imports: [RealtimeModule, AutomationModule, AiModule],
  controllers: [TeamsController, QueuesController, InboxController, QualityController, QualityConfigController, QuickMessagesController],
  providers: [TeamsService, QueuesService, InboxService, SummaryService, QualityService, QualityConfigService, QuickMessagesService],
})
export class AtendimentoModule {}
