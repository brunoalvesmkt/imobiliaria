import { IsString, MinLength } from "class-validator";

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}
