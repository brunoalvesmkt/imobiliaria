import { IsNotEmpty, IsString } from "class-validator";

export class RefundInvoiceDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}
