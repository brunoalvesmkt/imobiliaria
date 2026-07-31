import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { ProvidersModule } from "../whatsapp/providers/providers.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsListener } from "./notifications.listener";
import { NotificationSettingsController } from "./notification-settings.controller";
import { NotificationSettingsService } from "./notification-settings.service";

@Module({
  imports: [RealtimeModule, ProvidersModule],
  controllers: [NotificationsController, NotificationSettingsController],
  providers: [NotificationsService, NotificationsListener, NotificationSettingsService],
})
export class NotificationsModule {}
