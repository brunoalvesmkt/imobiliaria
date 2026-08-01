import { Module } from "@nestjs/common";
import { AuditLogController } from "./audit-log.controller";
import { MasterAuditLogController } from "./master-audit-log.controller";

@Module({
  controllers: [AuditLogController, MasterAuditLogController],
})
export class AuditLogModule {}
