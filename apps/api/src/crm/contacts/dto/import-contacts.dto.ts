import { IsString, MinLength } from "class-validator";

export class ImportContactsDto {
  @IsString()
  @MinLength(1)
  csv!: string;
}
