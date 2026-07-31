import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateQuickMessageDto } from "./create-quick-message.dto";

export class UpdateQuickMessageDto extends PartialType(CreateQuickMessageDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
