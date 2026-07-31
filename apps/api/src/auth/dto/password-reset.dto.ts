import { IsEmail, IsString, MinLength } from "class-validator";

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  token!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  novaSenha!: string;
}
