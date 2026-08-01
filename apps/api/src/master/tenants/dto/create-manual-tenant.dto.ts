import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

/**
 * Cadastro manual de empresa pelo Master (documento de alterações, item
 * 18.1) — bem mais enxuto que o signup público (`SignupTenantDto`): sem
 * endereço completo/segmento, sem confirmação de e-mail por código (o
 * Master já confirma a identidade da empresa por fora) e com senha
 * definida diretamente em vez de convite por e-mail.
 */
export class CreateManualTenantDto {
  @IsString()
  @MinLength(2)
  razaoSocial!: string;

  @IsString()
  @MinLength(11)
  cnpj!: string;

  @IsString()
  @MinLength(2)
  responsavel!: string;

  @IsEmail()
  email!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;

  @IsOptional()
  @IsUUID()
  planId?: string;
}
