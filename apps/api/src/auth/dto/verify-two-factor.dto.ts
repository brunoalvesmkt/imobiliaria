import { IsString, Length } from "class-validator";

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 6, { message: "código deve ter 6 dígitos" })
  codigo!: string;
}
