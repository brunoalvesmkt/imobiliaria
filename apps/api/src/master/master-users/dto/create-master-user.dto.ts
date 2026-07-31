import { IsEmail, IsIn, IsString, MinLength } from "class-validator";
import type { MasterRole } from "@chatbot-saas/database";

const ROLES: MasterRole[] = ["super_admin", "financeiro", "suporte"];

export class CreateMasterUserDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;

  @IsIn(ROLES)
  role!: MasterRole;
}
