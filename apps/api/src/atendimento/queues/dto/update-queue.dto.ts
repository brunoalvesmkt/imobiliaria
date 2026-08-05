import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsUUID } from "class-validator";
import { CreateQueueDto } from "./create-queue.dto";

export class UpdateQueueDto extends PartialType(OmitType(CreateQueueDto, ["teamId"] as const)) {
  // Campo redeclarado à parte (em vez de herdado de CreateQueueDto) para aceitar `null` — é como o
  // formulário desvincula a fila de uma equipe. @IsOptional() já pula a validação @IsUUID() para null.
  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}
