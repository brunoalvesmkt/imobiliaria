import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createBullRedisConnection } from "./redis-connection.factory";
import { NotificationsProducer } from "./notifications.producer";

/**
 * Fila "notifications" — exemplo funcional de ponta a ponta da
 * infraestrutura de filas (ver DEVELOPMENT_PLAN.md, item 1.8). Novas filas
 * (mensagens, automações, follow-ups, webhooks, relatórios, IA,
 * importações, agendamentos, reconexões — ver ARCHITECTURE.md §4) seguem o
 * mesmo padrão a partir das fases comerciais.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: createBullRedisConnection(config) }),
    }),
    BullModule.registerQueue({ name: "notifications" }),
  ],
  providers: [NotificationsProducer],
  exports: [NotificationsProducer],
})
export class QueuesModule {}
