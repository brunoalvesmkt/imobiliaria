import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateStageChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsInt()
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsBoolean()
  obrigatorioMotivo?: boolean;
}
