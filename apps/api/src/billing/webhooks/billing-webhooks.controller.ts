import { Controller, Headers, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { BillingService } from "../billing.service";
import { verifyStripeSignature } from "./stripe-signature.util";

interface StripeEvent {
  type: string;
  data: { object: { id: string; metadata?: { invoiceId?: string } } };
}

/**
 * Endpoint público (sem TenantAuthGuard) — é o Stripe quem chama, não um
 * usuário autenticado. Mesmo padrão do webhook da Meta
 * (`WhatsAppWebhooksController`): a fatura nunca é resolvida por um campo
 * livre do corpo, e sim pelo `gatewayRef` (id da sessão de checkout) já
 * gravado na fatura quando o pagamento foi iniciado — ver
 * `BillingService.confirmPaymentByGatewayRef`.
 */
@Controller("billing/webhooks")
export class BillingWebhooksController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Post("stripe")
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("stripe-signature") signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");

    if (!verifyStripeSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException("Assinatura de webhook inválida.");
    }

    const event = req.body as StripeEvent;

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await this.billing.confirmPaymentByGatewayRef(event.data.object.id);
    }

    res.status(200).send("EVENT_RECEIVED");
  }
}
