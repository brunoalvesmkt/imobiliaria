import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "../queues/redis-connection.factory";
import { AutomationModule } from "../automation/automation.module";
import { ContactsController } from "./contacts/contacts.controller";
import { ContactsService } from "./contacts/contacts.service";
import { FunnelsController } from "./funnels/funnels.controller";
import { FunnelsService } from "./funnels/funnels.service";
import { OpportunitiesController } from "./opportunities/opportunities.controller";
import { OpportunitiesService } from "./opportunities/opportunities.service";
import { CrmTasksController } from "./tasks/crm-tasks.controller";
import { CrmTasksService } from "./tasks/crm-tasks.service";
import { CrmTasksOverdueScheduler } from "./tasks/crm-tasks-overdue.scheduler";
import { MasterCrmTasksController } from "./tasks/master-crm-tasks.controller";
import { LeadScoreConfigController } from "./lead-score-config.controller";
import { LeadScoreConfigModule } from "./lead-score-config.module";
import { CrmVisibilityConfigController } from "./crm-visibility-config.controller";
import { CrmVisibilityConfigService } from "./crm-visibility-config.service";
import { CustomFieldsController } from "./custom-fields/custom-fields.controller";
import { CustomFieldsService } from "./custom-fields/custom-fields.service";
import { ContactOriginsController } from "./contact-origins/contact-origins.controller";
import { ContactOriginsService } from "./contact-origins/contact-origins.service";
import { TaskTypesController } from "./task-types/task-types.controller";
import { TaskTypesService } from "./task-types/task-types.service";
import { OpportunityReasonsController } from "./opportunity-reasons/opportunity-reasons.controller";
import { OpportunityReasonsService } from "./opportunity-reasons/opportunity-reasons.service";
import { ProductsController } from "./products/products.controller";
import { ProductsService } from "./products/products.service";
import { StageChecklistsController } from "./stage-checklists/stage-checklists.controller";
import { StageChecklistsService } from "./stage-checklists/stage-checklists.service";

@Module({
  imports: [
    AutomationModule,
    LeadScoreConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "crm-tasks" }),
  ],
  controllers: [
    ContactsController,
    FunnelsController,
    OpportunitiesController,
    CrmTasksController,
    MasterCrmTasksController,
    LeadScoreConfigController,
    CrmVisibilityConfigController,
    CustomFieldsController,
    ContactOriginsController,
    TaskTypesController,
    OpportunityReasonsController,
    ProductsController,
    StageChecklistsController,
  ],
  providers: [
    ContactsService,
    FunnelsService,
    OpportunitiesService,
    CrmTasksService,
    CrmTasksOverdueScheduler,
    CustomFieldsService,
    ContactOriginsService,
    TaskTypesService,
    CrmVisibilityConfigService,
    OpportunityReasonsService,
    ProductsService,
    StageChecklistsService,
  ],
})
export class CrmModule {}
