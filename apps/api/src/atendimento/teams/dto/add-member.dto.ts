import { IsIn, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class AddMemberDto {
  @IsUUID()
  tenantUserId!: string;

  @IsOptional()
  @IsIn(["agent", "supervisor"])
  papel?: "agent" | "supervisor";

  @IsOptional()
  @IsInt()
  @Min(0)
  prioridade?: number;
}
