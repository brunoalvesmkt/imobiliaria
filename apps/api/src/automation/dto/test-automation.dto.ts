import { IsOptional, IsUUID } from "class-validator";

export class TestAutomationDto {
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
