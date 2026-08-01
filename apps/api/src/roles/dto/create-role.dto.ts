import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { PermissionInputDto } from "./permission-input.dto";

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PermissionInputDto)
  permissions!: PermissionInputDto[];
}
