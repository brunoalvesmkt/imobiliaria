import { PartialType } from "@nestjs/mapped-types";
import { IsIn, IsOptional } from "class-validator";
import { CreateAutomationDto } from "./create-automation.dto";

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {
  @IsOptional()
  @IsIn(["active", "paused", "archived"])
  status?: "active" | "paused" | "archived";
}
