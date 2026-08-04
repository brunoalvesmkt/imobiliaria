import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;
}
