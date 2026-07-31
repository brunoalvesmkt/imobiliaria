import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainEventsService } from "../common/events/domain-events.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AffiliatesService } from "../affiliates/affiliates.service";
import { PAYMENT_PROVIDER } from "./providers/payment-providers.module";
import type { PaymentProvider } from "./providers/payment-provider.interface";
import type { SubscribeDto } from "./dto/subscribe.dto";
import type { PayInvoiceDto } from "./dto/pay-invoice.dto";

const INVOICE_DUE_DAYS = 7;

function addInterval(date: Date, recorrencia: string): Date {
  const next = new Date(date);
  if (recorrencia === "anual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly affiliates: AffiliatesService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  /** Planos disponíveis para contratação self-service — só os ativos, sem os campos administrativos que o Master vê. */
  listActivePlans() {
    return this.prisma.plan.findMany({ where: { ativo: true }, orderBy: { preco: "asc" } });
  }

  async getCurrentSubscription(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ["waiting", "active", "overdue", "delinquent"] } },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  listInvoices() {
    const tenantId = requireCurrentTenantId();
    return this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { subscription: { include: { plan: true } } },
    });
  }

  private async getOwnInvoice(id: string) {
    const tenantId = requireCurrentTenantId();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!invoice) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    return invoice;
  }

  /**
   * Contratação self-service pelo tenant — cria a assinatura em `waiting`
   * (não `active`; ver diferença consciente da concessão direta feita pelo
   * Master em MasterTenantsService.assignPlan) e a 1ª fatura `pending`. Só
   * vira `active` quando a fatura for paga (ver `payInvoice`).
   */
  async subscribe(dto: SubscribeDto) {
    const tenantId = requireCurrentTenantId();
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.ativo) {
      throw new NotFoundException("Plano não encontrado ou inativo.");
    }

    await this.prisma.subscription.updateMany({
      where: { tenantId, status: { in: ["waiting", "active", "overdue"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });

    const subscription = await this.prisma.subscription.create({
      data: { tenantId, planId: plan.id, status: "waiting" },
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        valor: plan.preco,
        status: "pending",
        vencimento: new Date(Date.now() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.record({
      actorId: tenantId,
      actorType: "tenant_user",
      action: "billing.subscribe",
      entity: "Subscription",
      entityId: subscription.id,
      tenantId,
      newData: { planId: plan.id, invoiceId: invoice.id },
    });

    return { subscription, invoice };
  }

  async payInvoice(invoiceId: string, dto: PayInvoiceDto) {
    const tenantId = requireCurrentTenantId();
    const invoice = await this.getOwnInvoice(invoiceId);
    if (invoice.status !== "pending" && invoice.status !== "overdue") {
      throw new BadRequestException("Esta fatura não está pendente de pagamento.");
    }

    const result = await this.paymentProvider.createCharge({
      invoiceId: invoice.id,
      tenantId,
      valor: invoice.valor.toString(),
      metodo: dto.metodo,
    });

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: result.status,
        metodo: dto.metodo,
        gatewayRef: result.gatewayRef,
        ...(result.status === "paid" ? { pagoEm: new Date() } : {}),
      },
    });

    if (result.status === "paid") {
      await this.onInvoicePaid(updated.id, invoice.subscriptionId, invoice.subscription.planId, tenantId, invoice.valor);
    }

    // checkoutUrl não é persistido (é efêmero, expira do lado do gateway) —
    // só passa direto na resposta para o frontend redirecionar quando houver.
    return result.checkoutUrl ? { ...updated, checkoutUrl: result.checkoutUrl } : updated;
  }

  /**
   * Confirmação assíncrona de pagamento vinda do webhook do gateway (ver
   * `BillingWebhooksController`) — o gatewayRef identifica a fatura sem
   * depender de tenant autenticado (o webhook não tem sessão de tenant).
   * Idempotente: se a fatura já estiver paga (webhook duplicado, comum em
   * gateways reais que reenviam eventos), não faz nada.
   */
  async confirmPaymentByGatewayRef(gatewayRef: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({ where: { gatewayRef }, include: { subscription: true } });
    if (!invoice) {
      this.logger.warn(`Webhook de pagamento confirmado para gatewayRef ${gatewayRef}, mas nenhuma fatura encontrada.`);
      return;
    }
    if (invoice.status === "paid") {
      return; // idempotência — evento duplicado do gateway
    }
    if (invoice.status !== "pending" && invoice.status !== "overdue") {
      this.logger.warn(`Webhook de pagamento confirmado para fatura ${invoice.id} em status inesperado "${invoice.status}".`);
      return;
    }

    const updated = await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: "paid", pagoEm: new Date() } });
    await this.onInvoicePaid(updated.id, invoice.subscriptionId, invoice.subscription.planId, invoice.tenantId, invoice.valor);
  }

  /**
   * Cancelamento self-service pelo próprio tenant — diferente do estorno
   * (`refundInvoice`, só o Master executa e reverte pagamento/comissão):
   * aqui não há reembolso, só para de cobrar a partir de agora. Faturas já
   * pagas continuam pagas; faturas ainda em aberto (`pending`/`overdue`)
   * são canceladas junto, para não ficarem cobráveis de uma assinatura morta.
   */
  async cancelSubscription() {
    const tenantId = requireCurrentTenantId();
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ["waiting", "active", "overdue", "delinquent"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) {
      throw new NotFoundException("Nenhuma assinatura ativa para cancelar.");
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });

    await this.prisma.invoice.updateMany({
      where: { subscriptionId: subscription.id, status: { in: ["pending", "overdue"] } },
      data: { status: "cancelled" },
    });

    this.domainEvents.emit("subscription.cancelled", { tenantId, data: { subscriptionId: subscription.id, motivo: "tenant_request" } });

    await this.audit.record({
      actorId: tenantId,
      actorType: "tenant_user",
      action: "billing.subscription.cancel",
      entity: "Subscription",
      entityId: subscription.id,
      tenantId,
    });

    return updated;
  }

  /** Cobrança manual pelo Master (dinheiro recebido fora do gateway — Pix direto, boleto físico, etc.). */
  async markPaidManually(tenantId: string, invoiceId: string, actor: { actorId: string; ip?: string | undefined; userAgent?: string | undefined }) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { subscription: true } });
    if (!invoice) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (invoice.status !== "pending" && invoice.status !== "overdue") {
      throw new BadRequestException("Esta fatura não está pendente de pagamento.");
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "paid", metodo: "manual", pagoEm: new Date() },
    });

    await this.onInvoicePaid(updated.id, invoice.subscriptionId, invoice.subscription.planId, tenantId, invoice.valor);

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId,
      action: "billing.invoice.mark_paid_manually",
      entity: "Invoice",
      entityId: invoice.id,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  private async onInvoicePaid(invoiceId: string, subscriptionId: string, planId: string, tenantId: string, valor: Prisma.Decimal) {
    const subscription = await this.prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    const wasFirstPayment = subscription.startedAt === null;

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: wasFirstPayment
        ? { status: "active", startedAt: new Date() }
        : { status: "active", renewedAt: new Date() },
    });

    this.domainEvents.emit("invoice.paid", { tenantId, data: { invoiceId, subscriptionId, planId, valor: valor.toString() } });
    if (wasFirstPayment) {
      this.domainEvents.emit("subscription.activated", { tenantId, data: { subscriptionId, planId } });
    }

    await this.affiliates.recordConversion(tenantId, wasFirstPayment ? "subscription" : "renewal", planId, valor);
  }

  /**
   * Estorno — só o Master executa (ver PERMISSIONS_MATRIX.md). Reverte a
   * fatura, cancela a assinatura vinculada e reverte a comissão de afiliado
   * pendente mais recente deste tenant (sem clawback de comissão já paga).
   */
  async refundInvoice(tenantId: string, invoiceId: string, motivo: string, actor: { actorId: string; ip?: string | undefined; userAgent?: string | undefined }) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, include: { subscription: true } });
    if (!invoice) {
      throw new NotFoundException("Fatura não encontrada.");
    }
    if (invoice.status !== "paid") {
      throw new BadRequestException("Só é possível estornar uma fatura paga.");
    }

    if (invoice.gatewayRef && invoice.metodo !== "manual") {
      await this.paymentProvider.refund({ invoiceId: invoice.id, gatewayRef: invoice.gatewayRef, valor: invoice.valor.toString() });
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "refunded", motivoEstorno: motivo },
    });

    await this.prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: { status: "refunded", cancelledAt: new Date() },
    });

    this.domainEvents.emit("subscription.cancelled", { tenantId, data: { subscriptionId: invoice.subscriptionId, motivo: "refund" } });
    await this.affiliates.reverseConversion(tenantId);

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId,
      action: "billing.invoice.refund",
      entity: "Invoice",
      entityId: invoice.id,
      newData: { motivo },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  /**
   * Verificação de cobrança recorrente — chamada por um job agendado
   * (`BillingScheduler`) e também exposta como gatilho manual para
   * Master/testes (`POST /master/billing/run-renewal-check`), já que
   * esperar um cron real disparar tornaria a fase impossível de testar de
   * ponta a ponta em tempo hábil.
   *
   * 1. Marca como `overdue` toda fatura `pending` vencida.
   * 2. Gera a próxima fatura de renovação para assinaturas `active` cujo
   *    ciclo (mensal/anual, conforme o plano) já venceu e que ainda não têm
   *    fatura em aberto.
   */
  async runRenewalCheck(): Promise<{ overdue: number; renewalsGenerated: number }> {
    const now = new Date();

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: "pending", vencimento: { lt: now } },
      include: { subscription: true },
    });
    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });
      await this.prisma.subscription.update({ where: { id: invoice.subscriptionId }, data: { status: "overdue" } });
      this.domainEvents.emit("invoice.overdue", { tenantId: invoice.tenantId, data: { invoiceId: invoice.id, subscriptionId: invoice.subscriptionId } });
    }

    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: "active" },
      include: { plan: true, invoices: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    let renewalsGenerated = 0;
    for (const subscription of activeSubscriptions) {
      const referenceDate = subscription.renewedAt ?? subscription.startedAt;
      if (!referenceDate) continue;

      const hasOpenInvoice = subscription.invoices.some((inv) => inv.status === "pending" || inv.status === "overdue");
      if (hasOpenInvoice) continue;

      const nextDue = addInterval(referenceDate, subscription.plan.recorrencia);
      if (nextDue > now) continue;

      await this.prisma.invoice.create({
        data: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          valor: subscription.plan.preco,
          status: "pending",
          vencimento: new Date(Date.now() + INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      renewalsGenerated += 1;
    }

    if (overdueInvoices.length > 0 || renewalsGenerated > 0) {
      this.logger.log(`Verificação de cobrança: ${overdueInvoices.length} fatura(s) vencida(s), ${renewalsGenerated} renovação(ões) gerada(s).`);
    }

    return { overdue: overdueInvoices.length, renewalsGenerated };
  }
}
