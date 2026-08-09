import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOpportunityReasonDto {
  @IsIn(["won", "lost"])
  tipo!: "won" | "lost";

  @IsString()
  @MinLength(1)
  nome!: string;

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
