import { MinLength } from "class-validator";

export class SetAffiliatePasswordDto {
  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;
}
