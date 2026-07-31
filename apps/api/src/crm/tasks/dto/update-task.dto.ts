import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataHora?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsIn(["pending", "done", "overdue"])
  status?: "pending" | "done" | "overdue";
}
