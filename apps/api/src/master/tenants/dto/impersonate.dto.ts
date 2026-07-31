import { IsIn } from "class-validator";

export class ImpersonateDto {
  @IsIn(["read", "read_write"])
  accessLevel!: "read" | "read_write";
}
