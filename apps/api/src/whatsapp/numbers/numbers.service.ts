import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as QRCode from "qrcode";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { PlatformSettingsService } from "../../master/settings/platform-settings.service";
import { ProviderRegistryService } from "../providers/provider-registry.service";
import type { ConnectResult, ProviderNumberContext } from "../providers/whatsapp-provider.interface";
import type { CreateNumberDto } from "./dto/create-number.dto";
import type { UpdateNumberDto } from "./dto/update-number.dto";
import type { AcceptRiskDto } from "./dto/accept-risk.dto";
import type { SetChatbotFlowDto } from "./dto/set-chatbot-flow.dto";

@Injectable()
export class NumbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly providers: ProviderRegistryService,
    private readonly domainEvents: DomainEventsService,
    private readonly config: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Provedor real (`baileys_unofficial`) por padrão para a modalidade não
   * oficial — trocável para `fake_unofficial` via env (usado nos testes
   * automatizados e em ambientes dev sem um telefone real disponível para
   * escanear o QR Code).
   */
  private providerNameFor(modalidade: "official_api" | "unofficial"): string {
    if (modalidade === "official_api") return "meta";
    return this.config.get<string>("WHATSAPP_UNOFFICIAL_PROVIDER") ?? "baileys_unofficial";
  }

  /** QR cru devolvido pelo provedor vira uma imagem PNG (data URI) pronta para `<img src>` — antes ficava como texto bruto, inútil na tela. */
  private async renderQr(result: ConnectResult): Promise<ConnectResult> {
    if (!result.qrCode) return result;
    const dataUrl = await QRCode.toDataURL(result.qrCode).catch(() => undefined);
    return dataUrl ? { ...result, qrCode: dataUrl } : result;
  }

  async list() {
    const numbers = await this.tenantPrisma.whatsAppNumber.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const currentTermVersion = (await this.platformSettings.get()).riskTermVersion;
    const acceptedVersions = await this.acceptedRiskVersions(numbers.map((n) => n.id));
    return numbers.map((number) => ({
      ...number,
      riskAccepted: acceptedVersions.get(number.id) === currentTermVersion,
    }));
  }

  async get(id: string) {
    const number = await this.tenantPrisma.whatsAppNumber.findFirst({ where: { id, deletedAt: null } });
    if (!number) {
      throw new NotFoundException("Número não encontrado.");
    }
    const currentTermVersion = (await this.platformSettings.get()).riskTermVersion;
    const acceptedVersions = await this.acceptedRiskVersions([id]);
    return { ...number, riskAccepted: acceptedVersions.get(id) === currentTermVersion };
  }

  /** Última versão do termo aceita por número — usada para detectar aceite desatualizado após o Master publicar uma nova versão (item 14.3). */
  private async acceptedRiskVersions(numberIds: string[]): Promise<Map<string, string>> {
    if (numberIds.length === 0) {
      return new Map();
    }
    const acceptances = await this.tenantPrisma.riskAcceptance.findMany({
      where: { whatsAppNumberId: { in: numberIds } },
      orderBy: { aceitoEm: "desc" },
    });
    const latest = new Map<string, string>();
    for (const acceptance of acceptances) {
      if (!latest.has(acceptance.whatsAppNumberId)) {
        latest.set(acceptance.whatsAppNumberId, acceptance.versaoTermo);
      }
    }
    return latest;
  }

  /** Limites do plano contratado (item 14.4) — `Plan.limites.numerosWhatsappOficial`/`numerosWhatsappNaoOficial`; ausente ou `null` = sem limite. */
  private async assertWithinPlanLimit(modalidade: "official_api" | "unofficial") {
    const tenantId = requireCurrentTenantId();
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, include: { plan: true } });
    const limites = tenant?.plan?.limites as Record<string, number | undefined> | undefined;
    const limitKey = modalidade === "official_api" ? "numerosWhatsappOficial" : "numerosWhatsappNaoOficial";
    const limit = limites?.[limitKey];
    if (limit === undefined || limit === null) return;

    const current = await this.prisma.whatsAppNumber.count({ where: { tenantId, modalidade, deletedAt: null } });
    if (current >= limit) {
      throw new ForbiddenException(
        `Limite do plano atingido: ${limit} número(s) na modalidade ${modalidade === "official_api" ? "oficial" : "não oficial"}.`,
      );
    }
  }

  async create(dto: CreateNumberDto, actorId: string) {
    const existing = await this.tenantPrisma.whatsAppNumber.findFirst({ where: { numero: dto.numero } });
    if (existing) {
      throw new ConflictException("Já existe um número cadastrado com esse valor.");
    }

    await this.assertWithinPlanLimit(dto.modalidade);

    const number = await this.tenantPrisma.whatsAppNumber.create({
      data: {
        nome: dto.nome ?? null,
        tipo: dto.tipo,
        modalidade: dto.modalidade,
        numero: dto.numero,
        provider: this.providerNameFor(dto.modalidade),
        externalAccountId: dto.externalAccountId ?? null,
        responsavelId: dto.responsavelId ?? null,
        status: "disconnected",
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.create",
      entity: "WhatsAppNumber",
      entityId: number.id,
      newData: { numero: number.numero, modalidade: number.modalidade },
    });

    return number;
  }

  /** Item 14.1 — apelido da conexão, editável a qualquer momento. */
  async update(id: string, dto: UpdateNumberDto, actorId: string) {
    await this.get(id);

    const data: Prisma.WhatsAppNumberUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;

    const updated = await this.tenantPrisma.whatsAppNumber.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.update",
      entity: "WhatsAppNumber",
      entityId: id,
      newData: { nome: updated.nome },
    });

    return updated;
  }

  /** Item 14.2 — exclusão (soft-delete): desconecta do provedor e marca `deletedAt`, preservando o histórico de conversas/mensagens já vinculado ao número. */
  async remove(id: string, actorId: string) {
    const number = await this.get(id);

    if (number.status !== "disconnected") {
      const provider = this.providers.resolve(number.provider);
      await provider.disconnect(this.toContext(number)).catch(() => undefined);
    }

    const tenantId = requireCurrentTenantId();
    await this.prisma.whatsAppNumber.update({
      where: { id, tenantId },
      data: { deletedAt: new Date(), status: "disconnected" },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.remove",
      entity: "WhatsAppNumber",
      entityId: id,
      previousData: { numero: number.numero },
    });

    return { status: "ok" as const };
  }

  private toContext(number: { id: string; tenantId: string; numero: string; externalAccountId: string | null }): ProviderNumberContext {
    return {
      id: number.id,
      tenantId: number.tenantId,
      numero: number.numero,
      externalAccountId: number.externalAccountId,
    };
  }

  async connect(id: string, actorId: string) {
    const number = await this.get(id);
    const provider = this.providers.resolve(number.provider);
    const result = await provider.connect(this.toContext(number));

    await this.tenantPrisma.whatsAppNumber.update({ where: { id }, data: { status: result.status } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.connect",
      entity: "WhatsAppNumber",
      entityId: id,
      newData: { status: result.status },
    });

    return this.renderQr(result);
  }

  /**
   * Polling do frontend enquanto `status === "authenticating"` — provedores
   * baseados em socket (Baileys) trocam o QR Code sozinhos a cada ~20s até
   * ser escaneado; `connect()` só captura o primeiro.
   */
  async getQr(id: string) {
    const number = await this.get(id);
    const provider = this.providers.resolve(number.provider);
    if (!provider.getLatestQr) {
      return { status: number.status };
    }
    const result = await provider.getLatestQr(this.toContext(number));
    return this.renderQr(result);
  }

  async confirmConnection(id: string, actorId: string) {
    const number = await this.get(id);
    const provider = this.providers.resolve(number.provider);

    if (!provider.confirmConnection) {
      throw new BadRequestException("Este provedor não requer confirmação de conexão.");
    }

    const result = await provider.confirmConnection(this.toContext(number));
    await this.tenantPrisma.whatsAppNumber.update({ where: { id }, data: { status: result.status } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.confirm_connection",
      entity: "WhatsAppNumber",
      entityId: id,
      newData: { status: result.status },
    });

    if (result.status === "connected") {
      this.domainEvents.emit("whatsapp_number.connected", {
        tenantId: requireCurrentTenantId(),
        data: { whatsAppNumberId: id, numero: number.numero },
      });
    }

    return result;
  }

  async disconnect(id: string, actorId: string) {
    const number = await this.get(id);
    const provider = this.providers.resolve(number.provider);
    await provider.disconnect(this.toContext(number));

    const updated = await this.tenantPrisma.whatsAppNumber.update({ where: { id }, data: { status: "disconnected" } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.disconnect",
      entity: "WhatsAppNumber",
      entityId: id,
    });

    this.domainEvents.emit("whatsapp_number.disconnected", {
      tenantId: requireCurrentTenantId(),
      data: { whatsAppNumberId: id, numero: number.numero },
    });

    return updated;
  }

  /** Item 14.3 — texto/versão atuais do termo de risco, definidos pelo Master em Configurações para Empresas. */
  async getRiskTerm() {
    const settings = await this.platformSettings.get();
    return { versao: settings.riskTermVersion, texto: settings.riskTermText };
  }

  /**
   * Aceite de risco obrigatório antes de enviar/automatizar em número na
   * modalidade não oficial — ver SECURITY.md §9 e seção 13.8 do prompt
   * mestre. Registro é permanente (não há "revogar aceite"); a versão
   * gravada é sempre a vigente no servidor no momento do aceite — nunca a
   * enviada pelo cliente (item 14.3: se o Master publicar uma nova versão,
   * aceites de versões antigas passam a contar como pendentes de novo).
   */
  async acceptRisk(id: string, dto: AcceptRiskDto, actorId: string, ip: string | undefined) {
    const number = await this.get(id);
    if (number.modalidade !== "unofficial") {
      throw new BadRequestException("Aceite de risco só se aplica a números na modalidade não oficial.");
    }

    const { versao } = await this.getRiskTerm();

    const acceptance = await this.tenantPrisma.riskAcceptance.create({
      data: {
        userId: actorId,
        whatsAppNumberId: id,
        versaoTermo: versao,
        ip: ip ?? null,
        recursosAtivados: (dto.recursosAtivados ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.risk_accepted",
      entity: "WhatsAppNumber",
      entityId: id,
      newData: { versaoTermo: versao },
    });

    return acceptance;
  }

  async hasAcceptedRisk(id: string): Promise<boolean> {
    const { versao } = await this.getRiskTerm();
    const acceptance = await this.tenantPrisma.riskAcceptance.findFirst({
      where: { whatsAppNumberId: id, versaoTermo: versao },
    });
    return acceptance !== null;
  }

  /** Vincula (ou remove, se omitido) o fluxo disparado automaticamente em toda conversa nova neste número. */
  async setChatbotFlow(id: string, dto: SetChatbotFlowDto, actorId: string) {
    const number = await this.get(id);
    if (number.tipo !== "chatbot") {
      throw new BadRequestException('Só números do tipo "chatbot" podem ter um fluxo automático.');
    }

    const updated = await this.tenantPrisma.whatsAppNumber.update({
      where: { id },
      data: { chatbotFlowId: dto.chatbotFlowId ?? null },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number.set_chatbot_flow",
      entity: "WhatsAppNumber",
      entityId: id,
      newData: { chatbotFlowId: dto.chatbotFlowId ?? null },
    });

    return updated;
  }
}
