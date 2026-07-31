import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { MasterTenantsController } from "./master-tenants.controller";
import { MasterTenantsService } from "./master-tenants.service";

@Module({
  imports: [AuthModule],
  controllers: [MasterTenantsController],
  providers: [MasterTenantsService],
})
export class MasterTenantsModule {}
