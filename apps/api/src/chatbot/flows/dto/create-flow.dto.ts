import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateFlowDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;
}
