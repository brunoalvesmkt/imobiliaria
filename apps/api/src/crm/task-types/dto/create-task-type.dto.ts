import { IsString, MinLength } from "class-validator";

export class CreateTaskTypeDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}
