import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/**
 * Meus Dados (documento de alterações, item 7) — deliberadamente sem `cnpj`
 * nem campos do plano: o documento os lista como exibidos na tela, mas
 * trocar o documento de identidade da empresa depois do cadastro é uma
 * decisão de negócio maior que um autoatendimento simples deveria cobrir
 * (aparece no relatório final como pendência).
 */
export class UpdateTenantProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  responsavel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsUUID()
  segmentoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cep?: string;
}
