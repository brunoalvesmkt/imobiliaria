import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { StorageModule } from "../../storage/storage.module";
import { MasterTenantsController } from "./master-tenants.controller";
import { MasterTenantsService } from "./master-tenants.service";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MasterTenantsController],
  providers: [MasterTenantsService],
})
export class MasterTenantsModule {}
