import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsIn(["produto", "servico"])
  tipo!: "produto" | "servico";

  @IsOptional()
  @IsString()
  descricaoCurta?: string;

  @IsNumber()
  @Min(0)
  preco!: number;
}
