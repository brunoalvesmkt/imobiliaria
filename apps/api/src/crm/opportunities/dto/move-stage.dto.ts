import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";

class MoveStageChecklistAnswerDto {
  @IsString()
  itemId!: string;

  @IsIn(["concluido", "nao_concluido"])
  resultado!: "concluido" | "nao_concluido";

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class MoveStageDto {
  @IsUUID()
  stageId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MoveStageChecklistAnswerDto)
  checklist?: MoveStageChecklistAnswerDto[];
}
