import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

export class UpdateStageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probabilidade?: number;

  @IsOptional()
  @IsObject()
  camposObrigatorios?: Record<string, boolean>;

  @IsOptional()
  @IsInt()
  @Min(1)
  slaHoras?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
