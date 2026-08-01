import { IsArray, IsOptional, IsString } from "class-validator";

export class AcceptRiskDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recursosAtivados?: string[];
}
