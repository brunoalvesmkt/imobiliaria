import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as QRCode from "qrcode";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { ProviderRegistryService } from "../providers/provider-registry.service";
import type { ConnectResult, ProviderNumberContext } from "../providers/whatsapp-provider.interface";
import type { CreateNumberDto } from "./dto/create-number.dto";
import type { AcceptRiskDto } from "./dto/accept-risk.dto";
import type { SetChatbotFlowDto } from "./dto/set-chatbot-flow.dto";

@Injectable()
export class NumbersService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly providers: ProviderRegistryService,
    private readonly domainEvents: DomainEventsService,
    private readonly config: ConfigService,
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
    const accepted = await this.acceptedRiskIds(numbers.map((n) => n.id));
    return numbers.map((number) => ({ ...number, riskAccepted: accepted.has(number.id) }));
  }

  async get(id: string) {
    const number = await this.tenantPrisma.whatsAppNumber.findFirst({ where: { id, deletedAt: null } });
    if (!number) {
      throw new NotFoundException("Número não encontrado.");
    }
    const accepted = await this.acceptedRiskIds([id]);
    return { ...number, riskAccepted: accepted.has(id) };
  }

  private async acceptedRiskIds(numberIds: string[]): Promise<Set<string>> {
    if (numberIds.length === 0) {
      return new Set();
    }
    const acceptances = await this.tenantPrisma.riskAcceptance.findMany({
      where: { whatsAppNumberId: { in: numberIds } },
    });
    return new Set(acceptances.map((a) => a.whatsAppNumberId));
  }

  async create(dto: CreateNumberDto, actorId: string) {
    const existing = await this.tenantPrisma.whatsAppNumber.findFirst({ where: { numero: dto.numero } });
    if (existing) {
      throw new ConflictException("Já existe um número cadastrado com esse valor.");
    }

    const number = await this.tenantPrisma.whatsAppNumber.create({
      data: {
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

  /**
   * Aceite de risco obrigatório antes de enviar/automatizar em número na
   * modalidade não oficial — ver SECURITY.md §9 e seção 13.8 do prompt
   * mestre. Registro é permanente (não há "revogar aceite").
   */
  async acceptRisk(id: string, dto: AcceptRiskDto, actorId: string, ip: string | undefined) {
    const number = await this.get(id);
    if (number.modalidade !== "unofficial") {
      throw new BadRequestException("Aceite de risco só se aplica a números na modalidade não oficial.");
    }

    const acceptance = await this.tenantPrisma.riskAcceptance.create({
      data: {
        userId: actorId,
        whatsAppNumberId: id,
        versaoTermo: dto.versaoTermo,
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
      newData: { versaoTermo: dto.versaoTermo },
    });

    return acceptance;
  }

  async hasAcceptedRisk(id: string): Promise<boolean> {
    const acceptance = await this.tenantPrisma.riskAcceptance.findFirst({ where: { whatsAppNumberId: id } });
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
