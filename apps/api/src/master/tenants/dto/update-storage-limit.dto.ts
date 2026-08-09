import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class UpdateStorageLimitDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  storageLimitMb?: number | null;

  @IsBoolean()
  storageUnlimited!: boolean;
}
