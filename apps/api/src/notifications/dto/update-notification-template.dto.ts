import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  corpo?: string;

  @IsOptional()
  @IsBoolean()
  critical?: boolean;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
