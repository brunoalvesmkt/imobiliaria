import { IsOptional, IsUUID } from "class-validator";

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsUUID()
  whatsAppNumberId?: string;
}
