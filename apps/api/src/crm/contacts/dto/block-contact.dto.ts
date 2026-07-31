import { IsOptional, IsString } from "class-validator";

export class BlockContactDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
