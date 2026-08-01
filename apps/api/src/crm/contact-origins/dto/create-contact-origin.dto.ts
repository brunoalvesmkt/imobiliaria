import { IsString, MinLength } from "class-validator";

export class CreateContactOriginDto {
  @IsString()
  @MinLength(1)
  nome!: string;
}
