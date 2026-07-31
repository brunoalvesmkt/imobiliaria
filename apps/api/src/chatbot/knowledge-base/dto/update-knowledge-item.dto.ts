import { IsBoolean, IsOptional } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { CreateKnowledgeItemDto } from "./create-knowledge-item.dto";

export class UpdateKnowledgeItemDto extends PartialType(CreateKnowledgeItemDto) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
