import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

const TIPOS = ["text", "image", "audio", "video", "document", "location"];

export class SimulateIncomingDto {
  @IsUUID()
  whatsAppNumberId!: string;

  @Matches(/^\d{10,15}$/, { message: "fromNumero deve conter apenas dígitos (formato E.164 sem +)" })
  fromNumero!: string;

  @IsOptional()
  @IsIn(TIPOS)
  tipo?: "text" | "image" | "audio" | "video" | "document" | "location";

  @IsOptional()
  @IsString()
  conteudo?: string;

  @IsOptional()
  @IsString()
  midiaUrl?: string;
}
