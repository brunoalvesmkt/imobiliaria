import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export const RISK_TERM_VERSION = "1.0";

export class AcceptRiskDto {
  @IsString()
  @MinLength(1)
  versaoTermo!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recursosAtivados?: string[];
}
