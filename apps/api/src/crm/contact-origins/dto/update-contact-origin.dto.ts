import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateContactOriginDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;

  /** Origem substituta para reatribuir contatos, exigida ao desativar uma origem em uso (item 11.1). */
  @IsOptional()
  @IsString()
  substitutaId?: string;
}
