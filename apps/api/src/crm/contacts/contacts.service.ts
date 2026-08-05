import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "@chatbot-saas/database";
import type { Contact, ContactOrigin, ContactPhone, ContactEmail } from "@chatbot-saas/database";

type ContactWithRelations = Contact & { phones: ContactPhone[]; emails: ContactEmail[]; origemRef: ContactOrigin | null };
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import type { CreateContactDto } from "./dto/create-contact.dto";
import type { UpdateContactDto } from "./dto/update-contact.dto";
import type { BlockContactDto } from "./dto/block-contact.dto";
import type { ContactPhoneDto } from "./dto/contact-phone.dto";
import type { ContactEmailDto } from "./dto/contact-email.dto";

/** Parser simples de linha CSV (RFC4180: campos entre aspas podem conter vírgula/quebra de linha/aspas duplicadas escapadas). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const DEDUP_FIELDS = ["whatsapp", "telefone", "email", "cpf", "cnpj"] as const;
type DedupField = (typeof DEDUP_FIELDS)[number];

/** Mantém os últimos 4 caracteres visíveis, mascara o resto — mesma lógica para CPF e CNPJ, sem depender do formato exato de pontuação. */
function maskDocument(value: string | null): string | null {
  if (!value) return value;
  if (value.length <= 4) return "*".repeat(value.length);
  return "*".repeat(value.length - 4) + value.slice(-4);
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  /**
   * CPF/CNPJ mascarados por padrão (SECURITY.md §8) — só quem tem a
   * permissão `crm.view_sensitive` (papel "admin" ganha de fábrica, ver
   * default-permissions.ts) vê o documento completo. `roleId` opcional para
   * não quebrar chamadas internas (LGPD export, automações) que não passam
   * por um ator com papel — nesse caso, mascara por padrão (mais seguro).
   */
  private async hasSensitiveAccess(roleId: string | undefined): Promise<boolean> {
    if (!roleId) return false;
    const permission = await this.prisma.permission.findFirst({
      where: { roleId, module: "crm", action: "view_sensitive" },
    });
    return permission !== null;
  }

  private maskContact<T extends { cpf: string | null; cnpj: string | null }>(contact: T): T {
    return { ...contact, cpf: maskDocument(contact.cpf), cnpj: maskDocument(contact.cnpj) };
  }

  async list(search?: string, roleId?: string, origemId?: string, responsavelId?: string, phoneType?: string) {
    const where: Prisma.ContactWhereInput = { deletedAt: null };
    if (origemId) where.origemId = origemId;
    if (responsavelId) where.responsavelId = responsavelId;
    if (phoneType) where.phones = { some: { tipo: phoneType } };
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { sobrenome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search } },
        { telefone: { contains: search } },
        { phones: { some: { numero: { contains: search } } } },
        { emails: { some: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }
    const contacts = await this.tenantPrisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { phones: true, emails: true, origemRef: true },
    });
    if (await this.hasSensitiveAccess(roleId)) {
      return contacts;
    }
    return contacts.map((c) => this.maskContact(c));
  }

  async get(id: string, roleId?: string): Promise<ContactWithRelations> {
    // `TenantScopedPrismaService.contact.findFirst` não é genérico o
    // suficiente para o TypeScript inferir o retorno com `include` — usa o
    // Prisma direto (com `tenantId` explícito) só aqui, igual já é feito em
    // `exportPersonalData` abaixo.
    const tenantId = requireCurrentTenantId();
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { phones: true, emails: true, origemRef: true },
    });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }
    if (await this.hasSensitiveAccess(roleId)) {
      return contact;
    }
    return this.maskContact(contact);
  }

  /**
   * Feed de tempo de ciclo das oportunidades do contato (ficha do contato,
   * módulo CRM) — para cada oportunidade, quanto tempo ficou em cada etapa
   * (data/hora de entrada e saída) e o tempo total até a etapa atual e até
   * ganha/perdida. Mesma base de dados (`OpportunityStageHistory`) dos
   * relatórios de tempo médio de ciclo do funil.
   */
  async getOpportunitiesTimeline(contactId: string) {
    const tenantId = requireCurrentTenantId();
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId, deletedAt: null } });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }

    const HOUR_MS = 60 * 60 * 1000;
    const round1 = (ms: number) => Math.round((ms / HOUR_MS) * 10) / 10;

    const opportunities = await this.prisma.opportunity.findMany({
      where: { contactId, tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        funnel: { select: { nome: true } },
        stage: { select: { nome: true } },
        stageHistory: { orderBy: { enteredAt: "asc" }, include: { stage: { select: { nome: true } } } },
      },
    });

    return opportunities.map((o) => ({
      id: o.id,
      funnelName: o.funnel.nome,
      currentStageName: o.stage.nome,
      status: o.status,
      valor: o.valor ? Number(o.valor) : null,
      createdAt: o.createdAt,
      wonAt: o.wonAt,
      lostAt: o.lostAt,
      totalTimeHours: round1((o.wonAt ?? o.lostAt ?? new Date()).getTime() - o.createdAt.getTime()),
      timeToWonHours: o.wonAt ? round1(o.wonAt.getTime() - o.createdAt.getTime()) : null,
      timeToLostHours: o.lostAt ? round1(o.lostAt.getTime() - o.createdAt.getTime()) : null,
      stages: o.stageHistory.map((h) => ({
        stageId: h.stageId,
        stageName: h.stage.nome,
        enteredAt: h.enteredAt,
        exitedAt: h.exitedAt,
        durationHours: h.exitedAt ? round1(h.exitedAt.getTime() - h.enteredAt.getTime()) : null,
      })),
    }));
  }

  /**
   * Histórico de movimentações do contato (ficha do contato, módulo CRM) —
   * reaproveita o AuditLog já gravado por toda ação relevante (criação,
   * edição, bloqueio, mesclagem, etc. — ver chamadas a `this.audit.record`
   * neste arquivo) em vez de manter um log próprio duplicado. Resolve o
   * nome do autor quando é um usuário do tenant (AuditLog só grava o id).
   */
  async history(contactId: string) {
    const tenantId = requireCurrentTenantId();
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId, deletedAt: null } });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }

    const entries = await this.audit.list({ tenantId, entity: "Contact", entityId: contactId, limit: 100 });
    const actorIds = [...new Set(entries.filter((e) => e.actorType === "tenant_user").map((e) => e.actorId))];
    const actors = actorIds.length
      ? await this.prisma.tenantUser.findMany({ where: { id: { in: actorIds } }, select: { id: true, nome: true } })
      : [];
    const actorNameById = new Map(actors.map((a) => [a.id, a.nome]));

    return entries.map((e) => ({
      id: e.id,
      action: e.action,
      actorType: e.actorType,
      actorName: e.actorType === "tenant_user" ? (actorNameById.get(e.actorId) ?? null) : null,
      timestamp: e.timestamp,
    }));
  }

  /**
   * Deduplicação por WhatsApp/telefone/e-mail/CPF/CNPJ, conforme as regras
   * ativas do tenant (`DeduplicationRule`) — se nenhuma regra estiver
   * configurada, verifica todos os campos por padrão (ver DATABASE_DESIGN.md
   * §3 e seção 10.3 do prompt mestre).
   */
  private async findDuplicate(dto: CreateContactDto): Promise<Contact | null> {
    const tenantId = requireCurrentTenantId();
    const rules = await this.tenantPrisma.deduplicationRule.findMany({ where: { ativo: true } });
    const activeFields: DedupField[] = rules.length > 0
      ? (rules.map((r) => r.campo).filter((f): f is DedupField => (DEDUP_FIELDS as readonly string[]).includes(f)))
      : [...DEDUP_FIELDS];

    for (const field of activeFields) {
      const value = dto[field];
      if (!value) {
        continue;
      }
      const existing = await this.prisma.contact.findFirst({
        where: { tenantId, deletedAt: null, [field]: value },
      });
      if (existing) {
        return existing;
      }
    }
    return null;
  }

  /**
   * `telefone`/`whatsapp` continuam sendo o telefone "principal" de cada
   * tipo, derivado de `phones` — mantém funcionando, sem alteração, a busca
   * de conversa por WhatsApp e todo o resto da suíte já testada em cima
   * desses dois campos (documento de alterações, item 10.1).
   */
  private legacyPhonesFromList(phones: ContactPhoneDto[] | undefined): { telefone?: string | null; whatsapp?: string | null } {
    if (!phones) return {};
    const pick = (tipo: string) => phones.find((p) => p.tipo === tipo && p.principal) ?? phones.find((p) => p.tipo === tipo);
    return {
      whatsapp: pick("whatsapp")?.numero ?? null,
      telefone: pick("residencial")?.numero ?? pick("comercial")?.numero ?? null,
    };
  }

  /** `email` continua sendo o e-mail "principal", derivado de `emails` — mesmo raciocínio de `legacyPhonesFromList`. */
  private legacyEmailFromList(emails: ContactEmailDto[] | undefined): { email?: string | null } {
    if (!emails) return {};
    const principal = emails.find((e) => e.principal) ?? emails[0];
    return { email: principal?.email ?? null };
  }

  async create(dto: CreateContactDto, actorId: string) {
    const duplicate = await this.findDuplicate(dto);
    if (duplicate) {
      throw new ConflictException({
        message: "Já existe um contato com esses dados.",
        contactId: duplicate.id,
      });
    }

    const legacyPhones = this.legacyPhonesFromList(dto.phones);
    const legacyEmail = this.legacyEmailFromList(dto.emails);
    const contact = await this.tenantPrisma.contact.create({
      data: {
        nome: dto.nome,
        sobrenome: dto.sobrenome ?? null,
        cpf: dto.cpf ?? null,
        cnpj: dto.cnpj ?? null,
        razaoSocial: dto.razaoSocial ?? null,
        telefone: legacyPhones.telefone ?? dto.telefone ?? null,
        whatsapp: legacyPhones.whatsapp ?? dto.whatsapp ?? null,
        email: legacyEmail.email ?? dto.email ?? null,
        origem: dto.origem ?? null,
        origemId: dto.origemId ?? null,
        campanha: dto.campanha ?? null,
        produto: dto.produto ?? null,
        servico: dto.servico ?? null,
        responsavelId: dto.responsavelId ?? null,
        observacoes: dto.observacoes ?? null,
        tags: dto.tags ?? [],
        ...(dto.customFields !== undefined ? { customFields: dto.customFields as Prisma.InputJsonValue } : {}),
        ...(dto.phones ? { phones: { create: dto.phones.map((p) => ({ numero: p.numero, tipo: p.tipo, principal: p.principal ?? false })) } } : {}),
        ...(dto.emails ? { emails: { create: dto.emails.map((e) => ({ email: e.email, principal: e.principal ?? false })) } } : {}),
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.create",
      entity: "Contact",
      entityId: contact.id,
      newData: { nome: contact.nome, whatsapp: contact.whatsapp, email: contact.email },
    });

    this.domainEvents.emit("contact.created", {
      tenantId: requireCurrentTenantId(),
      contactId: contact.id,
      data: { contactId: contact.id, origem: contact.origem },
    });

    return contact;
  }

  async update(id: string, dto: UpdateContactDto, actorId: string) {
    const before = await this.get(id);
    const { phones, emails, ...rest } = dto;

    const data: Prisma.ContactUncheckedUpdateInput = {};
    for (const key of Object.keys(rest) as Array<keyof typeof rest>) {
      const value = rest[key];
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    if (phones !== undefined) {
      const legacyPhones = this.legacyPhonesFromList(phones);
      if (legacyPhones.telefone !== undefined) data.telefone = legacyPhones.telefone;
      if (legacyPhones.whatsapp !== undefined) data.whatsapp = legacyPhones.whatsapp;
      // Substitui a lista inteira — mais simples e seguro que tentar
      // diffar item a item, e o formulário sempre envia a lista completa.
      await this.prisma.contactPhone.deleteMany({ where: { contactId: id } });
      if (phones.length > 0) {
        data.phones = { create: phones.map((p) => ({ numero: p.numero, tipo: p.tipo, principal: p.principal ?? false })) };
      }
    }

    if (emails !== undefined) {
      const legacyEmail = this.legacyEmailFromList(emails);
      if (legacyEmail.email !== undefined) data.email = legacyEmail.email;
      await this.prisma.contactEmail.deleteMany({ where: { contactId: id } });
      if (emails.length > 0) {
        data.emails = { create: emails.map((e) => ({ email: e.email, principal: e.principal ?? false })) };
      }
    }

    const updated = await this.tenantPrisma.contact.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.update",
      entity: "Contact",
      entityId: id,
      previousData: { nome: before.nome, email: before.email },
      newData: { nome: updated.nome, email: updated.email },
    });

    return updated;
  }

  /** Inativar (reversível) — marca o cadastro como inativo, sem apagar nada nem exigir permissão de administrador. */
  async deactivate(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.contact.update({ where: { id }, data: { ativo: false } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "contact.deactivate", entity: "Contact", entityId: id });

    return updated;
  }

  async reactivate(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.contact.update({ where: { id }, data: { ativo: true } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "contact.reactivate", entity: "Contact", entityId: id });

    return updated;
  }

  /**
   * Exclusão de verdade (irreversível) — só permitida quando o cadastro não
   * tem nenhuma movimentação (oportunidades, tarefas ou conversas); só o
   * papel de administrador chega a este botão no frontend, mas o backend
   * também garante a checagem, independente de quem chamar o endpoint.
   */
  async remove(id: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.get(id);

    const [opportunitiesCount, tasksCount, conversationsCount] = await Promise.all([
      this.prisma.opportunity.count({ where: { tenantId, contactId: id } }),
      this.prisma.crmTask.count({ where: { tenantId, contactId: id } }),
      this.prisma.conversation.count({ where: { tenantId, contactId: id } }),
    ]);
    if (opportunitiesCount > 0 || tasksCount > 0 || conversationsCount > 0) {
      throw new ConflictException(
        "Este contato tem movimentação (oportunidades, tarefas ou conversas) e não pode ser excluído — apenas cadastros sem histórico podem ser removidos.",
      );
    }

    await this.prisma.contact.delete({ where: { id, tenantId } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.remove",
      entity: "Contact",
      entityId: id,
    });

    return { status: "ok" as const };
  }

  /**
   * Exportação de dados pessoais sob demanda (LGPD, art. 18) — reúne tudo
   * que a plataforma guarda sobre este contato: o cadastro em si, as
   * oportunidades, tarefas e o conteúdo das conversas/mensagens vinculadas.
   * Não passa pelo `TenantScopedPrismaService` porque precisa de `include`
   * profundo (mensagens de todas as conversas), mais simples direto via
   * `PrismaService` com `tenantId` explícito no `where`.
   */
  async exportPersonalData(id: string) {
    const tenantId = requireCurrentTenantId();
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        opportunities: true,
        tasks: true,
        conversations: { include: { messages: true } },
        phones: true,
        emails: true,
      },
    });
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }
    return contact;
  }

  /**
   * Direito ao esquecimento (LGPD, art. 18, VI) — anonimiza em vez de
   * apagar a linha: mantém o `id` e os vínculos (oportunidades, tarefas,
   * conversas) intactos para não quebrar Kanban/relatórios/histórico
   * financeiro que referenciam este contato, mas remove todo dado
   * identificável. O conteúdo das mensagens trocadas com este contato
   * também é apagado (é dado pessoal — o texto da conversa).
   */
  async anonymize(id: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const contact = await this.get(id);
    if (contact.anonymizedAt) {
      return contact; // idempotente — já anonimizado
    }

    await this.prisma.contactPhone.deleteMany({ where: { contactId: id } });
    await this.prisma.contactEmail.deleteMany({ where: { contactId: id } });

    const anonymized = await this.tenantPrisma.contact.update({
      where: { id },
      data: {
        nome: "Contato removido (LGPD)",
        sobrenome: null,
        cpf: null,
        cnpj: null,
        razaoSocial: null,
        telefone: null,
        whatsapp: null,
        email: null,
        observacoes: null,
        customFields: Prisma.JsonNull,
        tags: [],
        anonymizedAt: new Date(),
      },
    });

    const conversationIds = (
      await this.prisma.conversation.findMany({ where: { tenantId, contactId: id }, select: { id: true } })
    ).map((c) => c.id);
    if (conversationIds.length > 0) {
      await this.prisma.message.updateMany({
        where: { tenantId, conversationId: { in: conversationIds } },
        data: { conteudo: null },
      });
    }

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.anonymize",
      entity: "Contact",
      entityId: id,
    });

    return anonymized;
  }

  /**
   * Bloquear contato (débito da auditoria contra o prompt mestre, seção 9 —
   * ações do atendente): impede novo envio de mensagem (manual, automação ou
   * chatbot — ver ConversationsService.sendMessage, AutomationProcessor,
   * ChatbotEngineService.sendNodeMessage) até ser desbloqueado. Não apaga
   * nem esconde o histórico já trocado.
   */
  async block(id: string, dto: BlockContactDto, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.contact.update({
      where: { id },
      data: { bloqueado: true, bloqueadoEm: new Date(), bloqueadoMotivo: dto.motivo ?? null },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.block",
      entity: "Contact",
      entityId: id,
      newData: { motivo: dto.motivo },
    });

    return updated;
  }

  async unblock(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.contact.update({
      where: { id },
      data: { bloqueado: false, bloqueadoEm: null, bloqueadoMotivo: null },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.unblock",
      entity: "Contact",
      entityId: id,
    });

    return updated;
  }

  /**
   * Unir cadastros duplicados (prompt mestre, Funcionalidade 3): `duplicateId`
   * é absorvido em `primaryId` — oportunidades, tarefas e conversas do
   * duplicado passam a apontar para o principal (preserva histórico
   * integralmente, só reatribui o dono); tags são unidas; campos
   * personalizados do duplicado preenchem só o que o principal não tinha
   * (principal nunca perde dado ao ser mesclado). O duplicado vira
   * soft-deleted ao final, não é apagado fisicamente.
   */
  async merge(primaryId: string, duplicateId: string, actorId: string) {
    if (primaryId === duplicateId) {
      throw new ConflictException("Não é possível unir um contato com ele mesmo.");
    }
    const tenantId = requireCurrentTenantId();
    const [primary, duplicate] = await Promise.all([this.get(primaryId), this.get(duplicateId)]);

    const mergedTags = Array.from(new Set([...primary.tags, ...duplicate.tags]));
    const existingPhoneNumbers = new Set(primary.phones.map((p) => p.numero));
    const phonesToAdopt = duplicate.phones.filter((p) => !existingPhoneNumbers.has(p.numero));
    const existingEmails = new Set(primary.emails.map((e) => e.email));
    const emailsToAdopt = duplicate.emails.filter((e) => !existingEmails.has(e.email));
    const duplicateFields = (duplicate.customFields ?? {}) as Record<string, unknown>;
    const primaryFields = (primary.customFields ?? {}) as Record<string, unknown>;
    const mergedCustomFields = { ...duplicateFields, ...primaryFields }; // principal tem prioridade em conflito

    await this.prisma.$transaction([
      this.prisma.opportunity.updateMany({ where: { tenantId, contactId: duplicateId }, data: { contactId: primaryId } }),
      this.prisma.crmTask.updateMany({ where: { tenantId, contactId: duplicateId }, data: { contactId: primaryId } }),
      this.prisma.conversation.updateMany({ where: { tenantId, contactId: duplicateId }, data: { contactId: primaryId } }),
      ...(phonesToAdopt.length > 0
        ? [
            this.prisma.contactPhone.updateMany({
              where: { id: { in: phonesToAdopt.map((p) => p.id) } },
              data: { contactId: primaryId, principal: false },
            }),
          ]
        : []),
      ...(emailsToAdopt.length > 0
        ? [
            this.prisma.contactEmail.updateMany({
              where: { id: { in: emailsToAdopt.map((e) => e.id) } },
              data: { contactId: primaryId, principal: false },
            }),
          ]
        : []),
      this.prisma.contact.update({
        where: { id: primaryId },
        data: {
          tags: mergedTags,
          customFields: mergedCustomFields as Prisma.InputJsonValue,
          cpf: primary.cpf ?? duplicate.cpf,
          cnpj: primary.cnpj ?? duplicate.cnpj,
          email: primary.email ?? duplicate.email,
          telefone: primary.telefone ?? duplicate.telefone,
          whatsapp: primary.whatsapp ?? duplicate.whatsapp,
        },
      }),
      this.prisma.contact.update({
        where: { id: duplicateId },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.merge",
      entity: "Contact",
      entityId: primaryId,
      previousData: { duplicateId },
      newData: { primaryId, duplicateId },
    });

    return this.get(primaryId, undefined);
  }

  /**
   * Importação de contatos (documento de alterações, item 10.5) — cabeçalho
   * flexível (nome das colunas em vez de posição fixa), reaproveitando a
   * mesma deduplicação/validação do cadastro manual. `importCsv`/`importXlsx`
   * só extraem `headers`/linhas de cada formato; `importRows` faz o trabalho
   * de verdade e é comum aos dois. Fica como pendência do relatório final: o
   * wizard com pré-visualização e mapeamento de colunas.
   */
  async importCsv(csv: string, actorId: string): Promise<{ imported: number; skipped: number; errors: { linha: number; mensagem: string }[] }> {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException("Arquivo CSV vazio ou sem linhas de dados.");
    }
    const headers = parseCsvLine(lines[0] as string);
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    return this.importRows(headers, rows, actorId);
  }

  /** `base64` é o conteúdo bruto do arquivo `.xlsx` codificado em base64 (o upload chega como JSON, não multipart). Só a primeira planilha do arquivo é lida. */
  async importXlsx(base64: string, actorId: string): Promise<{ imported: number; skipped: number; errors: { linha: number; mensagem: string }[] }> {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      throw new BadRequestException("Arquivo XLSX inválido — conteúdo não é base64 válido.");
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // Cast necessário — divergência de tipos entre versões de @types/node no monorepo (Buffer<ArrayBufferLike> vs Buffer); mesmo valor em runtime.
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new BadRequestException("Não foi possível ler o arquivo — confirme que é um .xlsx válido.");
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException("Planilha vazia ou sem linhas de dados.");
    }

    const toRow = (row: ExcelJS.Row): string[] => {
      const values: string[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = row.getCell(col).value;
        values.push(cell === null || cell === undefined ? "" : String(cell).trim());
      }
      return values;
    };

    const headers = toRow(sheet.getRow(1));
    const rows: string[][] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = toRow(sheet.getRow(r));
      if (row.some((v) => v !== "")) rows.push(row);
    }

    return this.importRows(headers, rows, actorId);
  }

  private async importRows(
    rawHeaders: string[],
    rows: string[][],
    actorId: string,
  ): Promise<{ imported: number; skipped: number; errors: { linha: number; mensagem: string }[] }> {
    const headers = rawHeaders.map((h) => h.toLowerCase());
    const columnIndex = (name: string) => headers.indexOf(name);
    const nomeIdx = columnIndex("nome");
    if (nomeIdx === -1) {
      throw new BadRequestException('Coluna obrigatória "nome" não encontrada no cabeçalho.');
    }

    let imported = 0;
    let skipped = 0;
    const errors: { linha: number; mensagem: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const linha = i + 2; // 1-based, contando o cabeçalho
      const fields = rows[i] as string[];
      const get = (name: string) => {
        const idx = columnIndex(name);
        return idx === -1 ? undefined : (fields[idx]?.trim() || undefined);
      };

      const nome = fields[nomeIdx]?.trim();
      if (!nome) {
        errors.push({ linha, mensagem: "Nome em branco — linha ignorada." });
        continue;
      }

      const sobrenome = get("sobrenome");
      const telefone = get("telefone");
      const whatsapp = get("whatsapp");
      const email = get("email");
      const origem = get("origem");
      const campanha = get("campanha");
      const documento = get("documento") ?? get("cpf") ?? get("cnpj");

      const dto: CreateContactDto = {
        nome,
        ...(sobrenome !== undefined ? { sobrenome } : {}),
        ...(telefone !== undefined ? { telefone } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(origem !== undefined ? { origem } : {}),
        ...(campanha !== undefined ? { campanha } : {}),
        ...(documento ? (documento.replace(/\D/g, "").length > 11 ? { cnpj: documento } : { cpf: documento }) : {}),
      };

      try {
        await this.create(dto, actorId);
        imported++;
      } catch (error) {
        if (error instanceof ConflictException) {
          skipped++;
        } else {
          errors.push({ linha, mensagem: error instanceof Error ? error.message : "Erro desconhecido." });
        }
      }
    }

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "contact.import",
      entity: "Contact",
      newData: { imported, skipped, errorCount: errors.length },
    });

    return { imported, skipped, errors };
  }
}
