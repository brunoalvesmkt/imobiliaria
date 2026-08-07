import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateNotificationRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;

  @IsString()
  @MaxLength(20)
  numero!: string;

  /** Tipos de notificação que este número recebe — vazio (ou omitido) = recebe todos. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tipos?: string[];
}
