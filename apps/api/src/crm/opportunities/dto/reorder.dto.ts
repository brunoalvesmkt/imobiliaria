import { ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class ReorderDto {
  @IsUUID()
  stageId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  orderedIds!: string[];
}
