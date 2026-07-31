/**
 * Contrato único de gateway de pagamento — qualquer adaptador real (Stripe,
 * Mercado Pago, PagSeguro) implementa esta interface. O módulo Financeiro só
 * fala com ela, nunca com um gateway específico (mesmo padrão do
 * WhatsAppProvider — ver ARCHITECTURE.md §6).
 */

export type PaymentMethod = "pix" | "boleto" | "cartao" | "manual";

export interface ChargeContext {
  invoiceId: string;
  tenantId: string;
  valor: string; // string decimal — evita perda de precisão na borda do provedor
  metodo: PaymentMethod;
}

export interface ChargeResult {
  gatewayRef: string;
  /** "paid" para métodos com confirmação imediata (ex.: cartão em simulador); "pending" para boleto/pix aguardando compensação. */
  status: "paid" | "pending";
  /** URL de checkout hospedada pelo gateway (ex.: Stripe Checkout) — presente só em provedores reais com fluxo de redirecionamento; ausente no simulador. */
  checkoutUrl?: string;
}

export interface RefundContext {
  invoiceId: string;
  gatewayRef: string;
  valor: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(context: ChargeContext): Promise<ChargeResult>;
  refund(context: RefundContext): Promise<void>;
}
