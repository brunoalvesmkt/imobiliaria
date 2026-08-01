import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { TenantsController } from "./tenants.controller";
import { PublicTenantController } from "./public-tenant.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [QueuesModule],
  controllers: [TenantsController, PublicTenantController],
  providers: [TenantsService],
})
export class TenantsModule {}
