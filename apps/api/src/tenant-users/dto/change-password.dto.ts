import { IsString, MinLength } from "class-validator";

export class ChangeOwnPasswordDto {
  @IsString()
  senhaAtual!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  novaSenha!: string;
}
