import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateFunnelDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
