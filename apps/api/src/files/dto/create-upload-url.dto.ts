import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class CreateUploadUrlDto {
  @IsString()
  @MinLength(1)
  nomeOriginal!: string;

  @IsString()
  @MinLength(3)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024) // 50 MB — limite conservador para a Fase 1; por módulo/plano entra em fases futuras.
  tamanho!: number;
}
