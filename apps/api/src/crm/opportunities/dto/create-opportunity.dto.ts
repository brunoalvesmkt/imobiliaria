import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateOpportunityDto {
  @IsUUID()
  contactId!: string;

  @IsUUID()
  funnelId!: string;

  @IsUUID()
  stageId!: string;

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
  origem?: string;

  @IsOptional()
  @IsString()
  campanha?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
