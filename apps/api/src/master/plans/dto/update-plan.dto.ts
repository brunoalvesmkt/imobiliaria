import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsIn(["mensal", "anual"])
  recorrencia?: "mensal" | "anual";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modulos?: string[];

  @IsOptional()
  @IsObject()
  limites?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  iaIncluida?: boolean;

  @IsOptional()
  @IsBoolean()
  apiOficial?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
