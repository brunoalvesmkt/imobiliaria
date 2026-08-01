import { IsUUID } from "class-validator";

export class TransferOpportunityDto {
  @IsUUID()
  targetFunnelId!: string;
}
