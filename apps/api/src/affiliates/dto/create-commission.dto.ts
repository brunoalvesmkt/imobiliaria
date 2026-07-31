import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from "class-validator";

const TIPOS = ["percentual", "fixo"] as const;

export class CreateCommissionDto {
  @IsIn(TIPOS)
  tipo!: (typeof TIPOS)[number];

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  moduleId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  prazoLimiteDias?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  carenciaDias?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimoParaPagamento?: number;
}
