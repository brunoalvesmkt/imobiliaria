import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateOpportunityItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  nome!: string;

  @IsNumber()
  @Min(0)
  preco!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;
}
