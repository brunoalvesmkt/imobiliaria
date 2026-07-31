import { IsString, MinLength } from "class-validator";

export class SaveAiCredentialDto {
  @IsString()
  @MinLength(8)
  apiKey!: string;
}
