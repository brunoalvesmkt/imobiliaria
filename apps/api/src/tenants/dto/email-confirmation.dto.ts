import { IsEmail, IsString, Length } from "class-validator";

export class RequestEmailChangeDto {
  @IsEmail()
  novoEmail!: string;
}

export class ConfirmEmailChangeDto {
  @IsString()
  @Length(6, 6, { message: "código deve ter 6 dígitos" })
  codigo!: string;
}
