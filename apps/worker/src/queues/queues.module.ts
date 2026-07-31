import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "./redis-connection.factory";
import { NotificationsProcessor } from "./notifications.processor";
import { LogEmailProvider } from "../notifications/log-email.provider";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "notifications" }),
  ],
  providers: [NotificationsProcessor, LogEmailProvider],
})
export class QueuesModule {}
