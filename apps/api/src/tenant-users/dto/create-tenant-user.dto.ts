import { IsEmail, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTenantUserDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;

  @IsUUID()
  roleId!: string;
}
