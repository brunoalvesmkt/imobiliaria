import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { toCsv } from "../reports/csv.util";
import { hashPassword } from "../auth/crypto.util";
import type { MasterActorContext } from "../master/plans/plans.service";
import type { CreateAffiliateDto } from "./dto/create-affiliate.dto";
import type { UpdateAffiliateStatusDto } from "./dto/update-affiliate-status.dto";
import type { CreateCommissionDto } from "./dto/create-commission.dto";

export type ReferralEvent = "click" | "signup" | "subscription" | "renewal" | "cancellation" | "refund";

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.affiliate.findMany({ orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate) {
      throw new NotFoundException("Afiliado não encontrado.");
    }
    return affiliate;
  }

  async create(dto: CreateAffiliateDto, actor: MasterActorContext) {
    const existing = await this.prisma.affiliate.findFirst({
      where: { OR: [{ cpf: dto.cpf }, { email: dto.email }] },
    });
    if (existing) {
      throw new ConflictException("Já existe um afiliado com esse CPF ou e-mail.");
    }

    const affiliate = await this.prisma.affiliate.create({
      data: {
        nome: dto.nome,
        sobrenome: dto.sobrenome,
        cpf: dto.cpf,
        email: dto.email,
        telefone: dto.telefone ?? null,
        whatsapp: dto.whatsapp ?? null,
        endereco: dto.endereco ?? null,
        status: "pending",
        linkCode: await this.generateUniqueLinkCode(),
      },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "affiliate.create",
      entity: "Affiliate",
      entityId: affiliate.id,
      newData: { nome: affiliate.nome, email: affiliate.email, linkCode: affiliate.linkCode },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return affiliate;
  }

  async updateStatus(id: string, dto: UpdateAffiliateStatusDto, actor: MasterActorContext) {
    const before = await this.get(id);

    const updated = await this.prisma.affiliate.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === "approved" && !before.aceitoTermosEm ? { aceitoTermosEm: new Date() } : {}),
      },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "affiliate.status_change",
      entity: "Affiliate",
      entityId: id,
      previousData: { status: before.status },
      newData: { status: updated.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async createCommission(affiliateId: string, dto: CreateCommissionDto, actor: MasterActorContext) {
    await this.get(affiliateId);

    const commission = await this.prisma.affiliateCommission.create({
      data: {
        affiliateId,
        tipo: dto.tipo,
        valor: dto.valor,
        recorrente: dto.recorrente ?? false,
        planId: dto.planId ?? null,
        moduleId: dto.moduleId ?? null,
        prazoLimiteDias: dto.prazoLimiteDias ?? null,
        carenciaDias: dto.carenciaDias ?? 0,
        minimoParaPagamento: dto.minimoParaPagamento ?? null,
      },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "affiliate.commission.create",
      entity: "AffiliateCommission",
      entityId: commission.id,
      newData: { affiliateId, tipo: commission.tipo, valor: commission.valor.toString() },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return commission;
  }

  /**
   * Define/redefine a senha do afiliado para o login de autoatendimento
   * (Fase 32, ver DEVELOPMENT_PLAN.md). Só o Master pode chamar isso — não
   * há fluxo de "esqueci minha senha" nesta fase (débito consciente,
   * registrado na seção da fase).
   */
  async setPassword(id: string, senha: string, actor: MasterActorContext) {
    await this.get(id);
    const passwordHash = await hashPassword(senha);
    await this.prisma.affiliate.update({ where: { id }, data: { passwordHash } });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "affiliate.password_set",
      entity: "Affiliate",
      entityId: id,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { id, passwordSet: true };
  }

  listCommissions(affiliateId: string) {
    return this.prisma.affiliateCommission.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } });
  }

  listReferrals(affiliateId: string) {
    return this.prisma.affiliateReferral.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } });
  }

  /** Rastreio de clique no link do afiliado — não gera comissão por si só, só marca o funil (ver DATABASE_DESIGN.md §11). */
  async trackClick(linkCode: string) {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { linkCode } });
    if (!affiliate || !["approved", "active"].includes(affiliate.status)) {
      throw new NotFoundException("Link de afiliado inválido.");
    }

    const referral = await this.prisma.affiliateReferral.create({
      data: { affiliateId: affiliate.id, evento: "click", status: "pending" },
    });
    return { trackingId: referral.id };
  }

  /**
   * Chamado pelo signup de tenant quando um `affiliateLinkCode` é informado.
   * Silencioso em caso de código inválido — um erro de digitação do lead não
   * pode bloquear o cadastro (ver AuthService.signupTenant).
   */
  async trackSignup(linkCode: string, tenantId: string): Promise<void> {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { linkCode } });
    if (!affiliate || !["approved", "active"].includes(affiliate.status)) {
      this.logger.warn(`Tentativa de cadastro com linkCode de afiliado inválido/inativo: ${linkCode}`);
      return;
    }

    await this.prisma.affiliateReferral.create({
      data: { affiliateId: affiliate.id, tenantId, evento: "signup", status: "pending" },
    });
  }

  /**
   * Calcula e registra a comissão de um evento de assinatura (contratação
   * paga ou renovação) — ver ACCEPTANCE_CRITERIA.md/prompt mestre §14.
   * Sem efeito se o tenant não veio de um afiliado ou se não há regra de
   * comissão aplicável (comissão específica do plano tem prioridade sobre a
   * regra genérica — `planId: null`).
   */
  async recordConversion(
    tenantId: string,
    evento: Extract<ReferralEvent, "subscription" | "renewal">,
    planId: string,
    valorCobrado: Prisma.Decimal | string,
  ): Promise<void> {
    const originReferral = await this.prisma.affiliateReferral.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    if (!originReferral) {
      return; // tenant não veio de um afiliado
    }

    const rules = await this.prisma.affiliateCommission.findMany({
      where: { affiliateId: originReferral.affiliateId, OR: [{ planId }, { planId: null }] },
    });
    if (rules.length === 0) {
      return;
    }
    const rule =
      rules.find((r) => r.planId === planId) ?? rules.find((r) => r.planId === null);
    if (!rule) {
      return;
    }
    if (evento === "renewal" && !rule.recorrente) {
      return; // regra não recorrente não gera comissão em renovações
    }

    const valor = new Prisma.Decimal(valorCobrado.toString());
    const valorComissao = rule.tipo === "percentual" ? valor.mul(rule.valor).div(100) : rule.valor;
    const elegivelEm = new Date(Date.now() + rule.carenciaDias * 24 * 60 * 60 * 1000);

    await this.prisma.affiliateReferral.create({
      data: {
        affiliateId: originReferral.affiliateId,
        tenantId,
        evento,
        planId,
        valorComissao,
        status: "pending",
        elegivelEm,
      },
    });
  }

  /**
   * Estorno de fatura reverte a comissão vinculada mais recente deste
   * tenant. Se ela ainda estava `pending`, vira `reversed` (nunca chegou a
   * ser paga, nada a recuperar). Se já tinha sido paga (`paid`) — estorno
   * tardio, depois de um lote de pagamento já ter saído — vira `clawback`:
   * fica como uma dívida do afiliado, deduzida automaticamente do próximo
   * lote de pagamento em `payEligibleReferrals`, nunca reembolsada
   * silenciosamente por conta própria da plataforma.
   */
  async reverseConversion(tenantId: string): Promise<void> {
    const relevant = await this.prisma.affiliateReferral.findFirst({
      where: { tenantId, evento: { in: ["subscription", "renewal"] }, status: { in: ["pending", "paid"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!relevant) {
      return;
    }
    await this.prisma.affiliateReferral.update({
      where: { id: relevant.id },
      data: { status: relevant.status === "paid" ? "clawback" : "reversed" },
    });
  }

  /**
   * Paga em lote todas as referências elegíveis (carência vencida) de um
   * afiliado, respeitando o mínimo para pagamento configurado — e deduzindo
   * qualquer `clawback` pendente (comissão já paga anteriormente, cuja
   * assinatura de origem foi estornada depois, ver `reverseConversion`).
   * O clawback nunca é cobrado do afiliado ativamente; ele só é compensado
   * automaticamente no próximo lote de pagamento, líquido do que seria pago.
   */
  async payEligibleReferrals(affiliateId: string, actor: MasterActorContext) {
    await this.get(affiliateId);

    const eligible = await this.prisma.affiliateReferral.findMany({
      where: {
        affiliateId,
        status: "pending",
        valorComissao: { not: null },
        elegivelEm: { lte: new Date() },
      },
    });
    if (eligible.length === 0) {
      throw new BadRequestException("Nenhuma comissão elegível para pagamento no momento.");
    }

    const outstandingClawbacks = await this.prisma.affiliateReferral.findMany({
      where: { affiliateId, status: "clawback", valorComissao: { not: null } },
    });

    const grossTotal = eligible.reduce((sum, r) => sum.add(r.valorComissao ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
    const clawbackTotal = outstandingClawbacks.reduce((sum, r) => sum.add(r.valorComissao ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
    const netTotal = grossTotal.sub(clawbackTotal);

    if (netTotal.lte(0)) {
      throw new BadRequestException(
        `Saldo líquido zerado ou negativo após deduzir estorno(s) tardio(s) de R$ ${clawbackTotal.toFixed(2)} — nada a pagar no momento.`,
      );
    }

    const rules = await this.prisma.affiliateCommission.findMany({ where: { affiliateId } });
    const minimo = rules.reduce(
      (max, r) => (r.minimoParaPagamento && r.minimoParaPagamento.gt(max) ? r.minimoParaPagamento : max),
      new Prisma.Decimal(0),
    );
    if (netTotal.lt(minimo)) {
      throw new BadRequestException(`Total líquido (R$ ${netTotal.toFixed(2)}) abaixo do mínimo para pagamento (R$ ${minimo.toFixed(2)}).`);
    }

    await this.prisma.affiliateReferral.updateMany({
      where: { id: { in: eligible.map((r) => r.id) } },
      data: { status: "paid" },
    });
    if (outstandingClawbacks.length > 0) {
      await this.prisma.affiliateReferral.updateMany({
        where: { id: { in: outstandingClawbacks.map((r) => r.id) } },
        data: { status: "clawback_settled" },
      });
    }

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "affiliate.commission.pay",
      entity: "Affiliate",
      entityId: affiliateId,
      newData: { quantidade: eligible.length, total: netTotal.toFixed(2), clawbackDeduzido: clawbackTotal.toFixed(2) },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { quantidade: eligible.length, total: netTotal.toFixed(2), clawbackDeduzido: clawbackTotal.toFixed(2) };
  }

  private async generateUniqueLinkCode(): Promise<string> {
    let candidate = randomBytes(5).toString("hex");
    while (await this.prisma.affiliate.findUnique({ where: { linkCode: candidate } })) {
      candidate = randomBytes(5).toString("hex");
    }
    return candidate;
  }

  async exportCsv(): Promise<string> {
    const affiliates = await this.prisma.affiliate.findMany({ orderBy: { createdAt: "desc" } });
    return toCsv(
      ["ID", "Nome", "E-mail", "CPF", "Status", "Código de link", "Criado em"],
      affiliates.map((a) => [a.id, `${a.nome} ${a.sobrenome}`, a.email, a.cpf, a.status, a.linkCode, a.createdAt.toISOString()]),
    );
  }
}
