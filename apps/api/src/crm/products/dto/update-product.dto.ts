import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsIn(["produto", "servico"])
  tipo?: "produto" | "servico";

  @IsOptional()
  @IsString()
  descricaoCurta?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
