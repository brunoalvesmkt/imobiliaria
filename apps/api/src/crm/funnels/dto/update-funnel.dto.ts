import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateFunnelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}
