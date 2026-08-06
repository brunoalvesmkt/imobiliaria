import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateCrmVisibilityConfigDto {
  @IsIn(["todos", "especificos"])
  semResponsavelModo!: "todos" | "especificos";

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  semResponsavelUsuarioIds?: string[];
}
