import { IsUUID } from "class-validator";

export class AssignQueueDto {
  @IsUUID()
  queueId!: string;
}
