import { IsIn } from "class-validator";

const METODOS = ["pix", "boleto", "cartao"] as const;

export class PayInvoiceDto {
  @IsIn(METODOS)
  metodo!: (typeof METODOS)[number];
}
