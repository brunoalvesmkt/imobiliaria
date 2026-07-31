import { IsOptional, IsString, IsUUID } from "class-validator";

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsUUID()
  whatsAppNumberId?: string;

  @IsOptional()
  @IsString()
  destinoNumero?: string;
}
