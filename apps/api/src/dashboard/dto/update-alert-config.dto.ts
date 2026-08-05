import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class UpdateAlertConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  queueWaitMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  opportunityStagnantDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  proposalNoResponseDays?: number;

  @IsOptional()
  @IsBoolean()
  taskOverdueEnabled?: boolean;
}
