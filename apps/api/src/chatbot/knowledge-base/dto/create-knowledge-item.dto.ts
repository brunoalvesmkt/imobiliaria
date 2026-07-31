import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

const TIPOS = [
  "empresa",
  "produto",
  "servico",
  "preco",
  "politica",
  "horario",
  "entrega",
  "garantia",
  "pagamento",
  "faq",
  "documento",
  "texto",
];

export class CreateKnowledgeItemDto {
  @IsIn(TIPOS)
  tipo!: string;

  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsString()
  @MinLength(1)
  conteudo!: string;

  @IsOptional()
  @IsUUID()
  arquivoId?: string;

  @IsOptional()
  @IsString()
  campanha?: string;

  /** Fase 58 — só relevante para tipo = "faq": formas alternativas de perguntar a mesma coisa. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variacoes?: string[];

  @IsOptional()
  @IsString()
  palavraChave?: string;

  @IsOptional()
  @IsInt()
  prioridade?: number;
}
