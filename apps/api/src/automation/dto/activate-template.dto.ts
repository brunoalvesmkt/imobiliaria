import { IsOptional, IsString, MaxLength } from "class-validator";

export class ActivateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string;
}
