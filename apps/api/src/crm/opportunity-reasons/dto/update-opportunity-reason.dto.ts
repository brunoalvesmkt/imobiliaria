import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateOpportunityReasonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  obrigatorioObservacao?: boolean;
}
