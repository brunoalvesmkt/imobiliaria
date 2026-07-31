import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateAffiliateDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  sobrenome!: string;

  @Matches(/^\d{11}$/, { message: "cpf deve conter 11 dígitos numéricos" })
  cpf!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  endereco?: string;
}
