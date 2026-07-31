import { BadGatewayException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChargeContext, ChargeResult, PaymentMethod, PaymentProvider, RefundContext } from "./payment-provider.interface";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

const STRIPE_PAYMENT_METHOD_TYPES: Partial<Record<PaymentMethod, string>> = {
  cartao: "card",
  pix: "pix",
  boleto: "boleto",
};

/**
 * Gateway real via Stripe Checkout — fetch nativo, sem SDK (mesmo padrão do
 * MetaOfficialProvider e dos provedores de IA: nenhuma dependência nova só
 * para chamar uma API REST). Cartão/Pix/Boleto passam todos pelo mesmo
 * fluxo de checkout hospedado (Stripe redireciona o tenant para uma página
 * própria) — diferente do FakeGatewayProvider, aqui NENHUM método confirma
 * de forma síncrona: mesmo cartão só é confirmado quando o webhook
 * `checkout.session.completed` chega (ver BillingWebhooksController). Isso
 * é deliberado: não há Stripe.js/Elements no frontend desta plataforma, e
 * cobrar um cartão de verdade exige coletar os dados em um contexto seguro
 * (iframe do gateway), que é exatamente o que o Checkout hospedado resolve
 * sem precisar construir esse formulário.
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private readonly logger = new Logger(StripeProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get secretKey(): string {
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!key) {
      throw new BadGatewayException("STRIPE_SECRET_KEY não configurada — gateway Stripe selecionado sem credencial.");
    }
    return key;
  }

  private get appUrl(): string {
    return this.config.get<string>("APP_URL") ?? "http://localhost:3000";
  }

  async createCharge(context: ChargeContext): Promise<ChargeResult> {
    const paymentMethodType = STRIPE_PAYMENT_METHOD_TYPES[context.metodo];
    if (!paymentMethodType) {
      throw new BadGatewayException(`Método de pagamento "${context.metodo}" não suportado pelo gateway Stripe.`);
    }

    const centavos = Math.round(Number(context.valor) * 100);
    const body = new URLSearchParams({
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(centavos),
      "line_items[0][price_data][product_data][name]": `Fatura ${context.invoiceId}`,
      "payment_method_types[0]": paymentMethodType,
      "metadata[invoiceId]": context.invoiceId,
      "metadata[tenantId]": context.tenantId,
      success_url: `${this.appUrl}/painel/financeiro?pagamento=sucesso`,
      cancel_url: `${this.appUrl}/painel/financeiro?pagamento=cancelado`,
    });

    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadGatewayException(`Falha ao criar sessão de checkout no Stripe: ${errorBody}`);
    }

    const session = (await response.json()) as { id: string; url: string };
    this.logger.log(`Checkout Stripe ${session.id} criado para invoice ${context.invoiceId} (${context.metodo}, R$ ${context.valor})`);

    // Todo método fica "pending" até o webhook confirmar — inclusive cartão,
    // já que a confirmação só acontece depois que o cliente completa o
    // checkout hospedado (ver docblock da classe).
    return { gatewayRef: session.id, status: "pending", checkoutUrl: session.url };
  }

  async refund(context: RefundContext): Promise<void> {
    const sessionResponse = await fetch(`${STRIPE_API_BASE}/checkout/sessions/${context.gatewayRef}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (!sessionResponse.ok) {
      throw new BadGatewayException(`Falha ao buscar sessão de checkout ${context.gatewayRef} no Stripe para estorno.`);
    }
    const session = (await sessionResponse.json()) as { payment_intent: string | null };
    if (!session.payment_intent) {
      throw new BadGatewayException(`Sessão de checkout ${context.gatewayRef} não tem pagamento confirmado — nada a estornar no Stripe.`);
    }

    const refundResponse = await fetch(`${STRIPE_API_BASE}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ payment_intent: session.payment_intent }),
    });
    if (!refundResponse.ok) {
      const errorBody = await refundResponse.text();
      throw new BadGatewayException(`Falha ao estornar no Stripe: ${errorBody}`);
    }
    this.logger.log(`Estorno Stripe do payment_intent ${session.payment_intent} (invoice ${context.invoiceId}, R$ ${context.valor})`);
  }
}
