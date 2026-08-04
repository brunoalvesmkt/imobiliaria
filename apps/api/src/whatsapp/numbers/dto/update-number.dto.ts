import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateNumberDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nome?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  /** Se uma nova palavra-chave deve interromper o fluxo do chatbot em andamento na conversa (ver ACCEPTANCE_CRITERIA.md). */
  @IsOptional()
  @IsBoolean()
  interromperFluxoAtual?: boolean;
}
