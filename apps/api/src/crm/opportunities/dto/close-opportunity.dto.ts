import { IsIn, IsOptional, IsString } from "class-validator";

export class CloseOpportunityDto {
  @IsIn(["won", "lost"])
  resultado!: "won" | "lost";

  @IsOptional()
  @IsString()
  motivo?: string;
}
