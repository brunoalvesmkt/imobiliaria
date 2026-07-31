import { IsISO8601, IsOptional } from "class-validator";

export class DateRangeDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export function resolveDateRange(dto: DateRangeDto): { from: Date; to: Date } {
  const to = dto.to ? new Date(dto.to) : new Date();
  const from = dto.from ? new Date(dto.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}
