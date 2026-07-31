import { IsInt, Min } from "class-validator";

export class UpdateMemberDto {
  @IsInt()
  @Min(0)
  prioridade!: number;
}
