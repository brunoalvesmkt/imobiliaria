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
  @Max(100 * 1024 * 1024) // 100 MB — maior limite entre os tipos de mídia do WhatsApp (documento); a validação fina por tipo fica no frontend do card de mídia do chatbot.
  tamanho!: number;
}
