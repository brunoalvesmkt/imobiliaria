import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export const CUSTOM_FIELD_TYPES = [
  "texto",
  "numero",
  "data",
  "moeda",
  "lista",
  "multipla_escolha",
  "booleano",
  "texto_longo",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export class CreateCustomFieldDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsString()
  @MinLength(1)
  chave!: string;

  @IsIn(CUSTOM_FIELD_TYPES)
  tipo!: CustomFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  opcoes?: string[];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;
}
