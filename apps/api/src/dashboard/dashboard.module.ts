import { Module } from "@nestjs/common";
import { RealtimeModule } from "../realtime/realtime.module";
import { ReportsModule } from "../reports/reports.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [RealtimeModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
