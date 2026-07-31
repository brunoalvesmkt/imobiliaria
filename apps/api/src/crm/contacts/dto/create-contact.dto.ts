import { IsArray, IsEmail, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  sobrenome?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  origem?: string;

  @IsOptional()
  @IsString()
  campanha?: string;

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
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
