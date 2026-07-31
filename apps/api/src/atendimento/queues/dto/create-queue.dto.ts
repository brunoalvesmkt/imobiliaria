import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

const DISTRIBUICOES = ["round_robin", "least_volume", "priority"];

export class CreateQueueDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  prioridade?: number;

  @IsOptional()
  @IsIn(DISTRIBUICOES)
  distribuicao?: "round_robin" | "least_volume" | "priority";

  @IsOptional()
  @IsInt()
  @Min(1)
  slaMinutos?: number;

  @IsOptional()
  @IsString()
  mensagemEspera?: string;

  @IsOptional()
  @IsString()
  mensagemForaExpediente?: string;
}
