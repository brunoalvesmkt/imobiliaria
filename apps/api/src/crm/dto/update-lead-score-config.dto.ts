import { IsInt, Max, Min } from "class-validator";

export class UpdateLeadScoreConfigDto {
  @IsInt()
  @Min(1)
  @Max(99)
  morno!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  quente!: number;
}
