import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTaskTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsInt()
  ordem?: number;
}
