import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateStageChecklistItemDto {
  @IsString()
  stageId!: string;

  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsOptional()
  @IsInt()
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  obrigatorioMotivo?: boolean;
}
