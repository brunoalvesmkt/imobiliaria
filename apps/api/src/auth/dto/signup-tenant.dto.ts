import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

/**
 * A validação de verdade é a do schema Zod em `@chatbot-saas/validation`
 * (`signupTenantSchema`, aplicado via `ZodValidationPipe` no controller).
 * Estes decorators existem só porque o `ValidationPipe` global do Nest
 * (`whitelist: true, forbidNonWhitelisted: true` em `main.ts`) roda em
 * cima de todo `@Body()`, inclusive quando há um pipe adicional — uma
 * classe sem nenhum decorator de `class-validator` faz o whitelist
 * remover/rejeitar todas as propriedades antes do Zod sequer rodar (ver
 * mesmo padrão já usado em `CreateContactDto`/`createContactSchema`).
 */
export class SignupTenantDto {
  @IsString()
  razaoSocial!: string;

  @IsString()
  cnpj!: string;

  @IsString()
  responsavel!: string;

  @IsString()
  telefone!: string;

  @IsString()
  whatsapp!: string;

  @IsUUID()
  segmentoId!: string;

  @IsString()
  endereco!: string;

  @IsString()
  numero!: string;

  @IsString()
  bairro!: string;

  @IsString()
  cidade!: string;

  @IsString()
  uf!: string;

  @IsString()
  cep!: string;

  @IsString()
  email!: string;

  @IsString()
  confirmacaoEmail!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;

  @IsString()
  confirmacaoSenha!: string;

  @IsUUID()
  planId!: string;

  @IsIn(["mensal", "anual"])
  periodicidade!: "mensal" | "anual";

  @IsOptional()
  @IsString()
  affiliateLinkCode?: string;
}
