import { IsIn, IsString, MinLength } from "class-validator";

export class ImportContactsDto {
  @IsIn(["csv", "xlsx"])
  format!: "csv" | "xlsx";

  /** Texto CSV puro quando `format === "csv"`; conteúdo do arquivo em base64 quando `format === "xlsx"`. */
  @IsString()
  @MinLength(1)
  content!: string;
}
