import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateChecklistProgressDto {
  @IsString()
  itemId!: string;

  @IsIn(["concluido", "nao_concluido"])
  resultado!: "concluido" | "nao_concluido";

  @IsOptional()
  @IsString()
  motivo?: string;
}
