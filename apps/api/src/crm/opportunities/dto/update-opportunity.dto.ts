import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class UpdateOpportunityDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsString()
  produto?: string;

  @IsOptional()
  @IsString()
  servico?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsDateString()
  previsaoFechamento?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
