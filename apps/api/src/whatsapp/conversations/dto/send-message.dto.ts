import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

const TIPOS = ["text", "image", "audio", "video", "document", "location"];

export class SendMessageDto {
  @IsIn(TIPOS)
  tipo!: "text" | "image" | "audio" | "video" | "document" | "location";

  @IsOptional()
  @IsString()
  @MinLength(1)
  texto?: string;

  @IsOptional()
  @IsString()
  midiaUrl?: string;
}
