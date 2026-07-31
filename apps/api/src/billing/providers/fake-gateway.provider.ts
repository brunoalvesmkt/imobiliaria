import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ChargeContext, ChargeResult, PaymentProvider, RefundContext } from "./payment-provider.interface";

/**
 * Simulador de gateway de pagamento para desenvolvimento/teste — não há
 * credenciais reais de um gateway (Stripe/Mercado Pago) disponíveis neste
 * ambiente (mesma situação do FakeUnofficialProvider do WhatsApp, ver
 * DEVELOPMENT_PLAN.md Fase 4). Cartão e Pix confirmam pagamento
 * imediatamente (simulando aprovação síncrona); boleto fica "pending"
 * (aguardando compensação, como no mundo real) — a confirmação de boleto
 * chegaria depois via webhook do gateway, fora do escopo simulável aqui.
 */
@Injectable()
export class FakeGatewayProvider implements PaymentProvider {
  readonly name = "fake_gateway";
  private readonly logger = new Logger(FakeGatewayProvider.name);

  async createCharge(context: ChargeContext): Promise<ChargeResult> {
    const gatewayRef = `fake_${context.metodo}_${randomUUID()}`;
    this.logger.log(`Cobrança simulada ${gatewayRef} para invoice ${context.invoiceId} (${context.metodo}, R$ ${context.valor})`);

    if (context.metodo === "boleto") {
      return { gatewayRef, status: "pending" };
    }
    return { gatewayRef, status: "paid" };
  }

  async refund(context: RefundContext): Promise<void> {
    this.logger.log(`Estorno simulado da cobrança ${context.gatewayRef} (invoice ${context.invoiceId}, R$ ${context.valor})`);
  }
}
