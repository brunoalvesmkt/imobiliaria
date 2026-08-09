import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "../queues/redis-connection.factory";
import { NotificationsModule } from "../notifications/notifications.module";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";
import { StorageReconciliationScheduler } from "./storage-reconciliation.scheduler";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "storage" }),
    NotificationsModule,
  ],
  controllers: [StorageController],
  providers: [StorageService, StorageReconciliationScheduler],
  exports: [StorageService],
})
export class StorageModule {}
