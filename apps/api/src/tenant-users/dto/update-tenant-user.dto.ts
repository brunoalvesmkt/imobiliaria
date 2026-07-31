import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
