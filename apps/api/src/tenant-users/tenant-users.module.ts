import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { TenantUsersController } from "./tenant-users.controller";
import { TenantUsersService } from "./tenant-users.service";

@Module({
  imports: [QueuesModule],
  controllers: [TenantUsersController],
  providers: [TenantUsersService],
})
export class TenantUsersModule {}
