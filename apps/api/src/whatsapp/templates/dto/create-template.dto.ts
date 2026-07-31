import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  idioma?: string;

  @IsIn(["marketing", "utility", "authentication"])
  categoria!: "marketing" | "utility" | "authentication";

  @IsOptional()
  @IsString()
  cabecalho?: string;

  @IsString()
  @MinLength(1)
  corpo!: string;

  @IsOptional()
  @IsString()
  rodape?: string;

  @IsOptional()
  @IsArray()
  variaveis?: string[];

  @IsOptional()
  @IsObject()
  botoes?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  whatsAppNumberId?: string;
}
