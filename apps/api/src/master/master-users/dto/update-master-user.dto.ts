import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { MasterRole } from "@chatbot-saas/database";

const ROLES: MasterRole[] = ["super_admin", "financeiro", "suporte"];

export class UpdateMasterUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: MasterRole;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
