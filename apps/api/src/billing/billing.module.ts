import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "../queues/redis-connection.factory";
import { AffiliatesModule } from "../affiliates/affiliates.module";
import { PaymentProvidersModule } from "./providers/payment-providers.module";
import { BillingController } from "./billing.controller";
import { MasterBillingController } from "./master-billing.controller";
import { BillingWebhooksController } from "./webhooks/billing-webhooks.controller";
import { BillingService } from "./billing.service";
import { BillingScheduler } from "./billing.scheduler";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "billing" }),
    PaymentProvidersModule,
    AffiliatesModule,
  ],
  controllers: [BillingController, MasterBillingController, BillingWebhooksController],
  providers: [BillingService, BillingScheduler],
})
export class BillingModule {}
