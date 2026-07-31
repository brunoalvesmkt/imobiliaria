import { IsUUID } from "class-validator";

export class MoveStageDto {
  @IsUUID()
  stageId!: string;
}
