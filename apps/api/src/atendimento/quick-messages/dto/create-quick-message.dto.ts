import { IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateQuickMessageDto {
  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsString()
  @MinLength(1)
  texto!: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  atalho?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
