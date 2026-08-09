import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateOpportunityItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;
}
