import { Module } from "@nestjs/common";
import { MasterUsersController } from "./master-users.controller";
import { MasterUsersService } from "./master-users.service";

@Module({
  controllers: [MasterUsersController],
  providers: [MasterUsersService],
})
export class MasterUsersModule {}
