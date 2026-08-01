import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateNumberDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nome?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;
}
