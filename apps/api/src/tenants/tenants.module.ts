import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { PublicTenantController } from "./public-tenant.controller";

@Module({
  controllers: [TenantsController, PublicTenantController],
})
export class TenantsModule {}
