import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuditModule } from "./common/audit/audit.module";
import { DomainEventsModule } from "./common/events/domain-events.module";
import { TenantContextInterceptor } from "./common/tenant/tenant-context.interceptor";
import { AuthModule } from "./auth/auth.module";
import { TenantUsersModule } from "./tenant-users/tenant-users.module";
import { RolesModule } from "./roles/roles.module";
import { TenantsModule } from "./tenants/tenants.module";
import { FilesModule } from "./files/files.module";
import { QueuesModule } from "./queues/queues.module";
import { PlansModule } from "./master/plans/plans.module";
import { PlatformSettingsModule } from "./master/settings/platform-settings.module";
import { BrandingModule } from "./branding/branding.module";
import { MasterTenantsModule } from "./master/tenants/master-tenants.module";
import { MasterUsersModule } from "./master/master-users/master-users.module";
import { CrmModule } from "./crm/crm.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { AtendimentoModule } from "./atendimento/atendimento.module";
import { ChatbotModule } from "./chatbot/chatbot.module";
import { AiModule } from "./ai/ai.module";
import { AutomationModule } from "./automation/automation.module";
import { BillingModule } from "./billing/billing.module";
import { AffiliatesModule } from "./affiliates/affiliates.module";
import { PublicCatalogModule } from "./public-catalog/public-catalog.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditLogModule } from "./audit-log/audit-log.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    EventEmitterModule.forRoot({ wildcard: false }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    AuditModule,
    DomainEventsModule,
    AuthModule,
    TenantUsersModule,
    RolesModule,
    TenantsModule,
    FilesModule,
    QueuesModule,
    PlansModule,
    PlatformSettingsModule,
    BrandingModule,
    MasterTenantsModule,
    MasterUsersModule,
    CrmModule,
    WhatsappModule,
    AtendimentoModule,
    AiModule,
    ChatbotModule,
    AutomationModule,
    AffiliatesModule,
    PublicCatalogModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
