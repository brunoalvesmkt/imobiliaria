import { Type } from "class-transformer";
import { IsArray, IsEmail, IsObject, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from "class-validator";
import { ContactPhoneDto } from "./contact-phone.dto";
import { ContactEmailDto } from "./contact-email.dto";

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

  /** Múltiplos e-mails — quando informado, substitui `email` como fonte de verdade. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactEmailDto)
  emails?: ContactEmailDto[];

  @IsOptional()
  @IsString()
  origem?: string;

  /** Origem via lista configurável (documento de alterações, item 10.2) — tem prioridade sobre `origem` quando informada. */
  @IsOptional()
  @IsUUID()
  origemId?: string;

  /** Múltiplos telefones (item 10.1) — quando informado, substitui `telefone`/`whatsapp` como fonte de verdade. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPhoneDto)
  phones?: ContactPhoneDto[];

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
