import { IsOptional, IsUUID } from "class-validator";

export class SetChatbotFlowDto {
  @IsOptional()
  @IsUUID()
  chatbotFlowId?: string;
}
