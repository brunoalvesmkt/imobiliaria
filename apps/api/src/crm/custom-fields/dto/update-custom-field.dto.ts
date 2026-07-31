import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsInt, IsOptional } from "class-validator";
import { CreateCustomFieldDto } from "./create-custom-field.dto";

export class UpdateCustomFieldDto extends PartialType(CreateCustomFieldDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;
}
