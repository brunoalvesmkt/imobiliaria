import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateNotificationRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tipos?: string[];

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
