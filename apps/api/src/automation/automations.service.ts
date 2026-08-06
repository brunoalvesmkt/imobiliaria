import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { buildAutomationCatalog, validateAutomationActions } from "./automation-definition.types";
import { AutomationProducer } from "./automation.producer";
import type { CreateAutomationDto } from "./dto/create-automation.dto";
import type { UpdateAutomationDto } from "./dto/update-automation.dto";

@Injectable()
export class AutomationsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly producer: AutomationProducer,
  ) {}

  list() {
    return this.tenantPrisma.automation.findMany({ orderBy: { createdAt: "desc" } });
  }

  /** Catálogo de gatilhos/ações disponíveis para este tenant, já filtrado pelos módulos ativos (ver `buildAutomationCatalog`). Fonte única consumida pelo formulário de criação/edição no frontend. */
  async getCatalog() {
    const flags = await this.tenantPrisma.featureFlag.findMany({ where: { enabled: true } });
    const activeModules = new Set(flags.map((f) => f.module));
    return buildAutomationCatalog(activeModules);
  }

  async get(id: string) {
    const automation = await this.tenantPrisma.automation.findFirst({ where: { id } });
    if (!automation) {
      throw new NotFoundException("Automação não encontrada.");
    }
    return automation;
  }

  async create(dto: CreateAutomationDto, actorId: string) {
    const errors = validateAutomationActions(dto.acoes);
    if (errors.length > 0) {
      throw new BadRequestException({ message: "Automação inválida.", errors });
    }

    // Gerado sempre (não só quando há "send_webhook" nas ações) para já existir
    // caso a automação seja editada depois para incluir essa ação.
    const webhookSecret = `whsec_${randomBytes(24).toString("hex")}`;

    const automation = await this.tenantPrisma.automation.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        tipoAutomacao: dto.tipoAutomacao ?? null,
        cooldownMinutos: dto.cooldownMinutos ?? null,
        gatilhoTipo: dto.gatilhoTipo,
        condicoes: (dto.condicoes ?? null) as unknown as Prisma.InputJsonValue,
        acoes: dto.acoes as unknown as Prisma.InputJsonValue,
        status: "active",
        webhookSecret,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "automation.create",
      entity: "Automation",
      entityId: automation.id,
      newData: { nome: automation.nome, gatilhoTipo: automation.gatilhoTipo },
    });

    return automation;
  }

  /**
   * Disparo manual (Fase 28) — cria e enfileira uma execução real (mesmo
   * caminho de fila/retry/dead-letter de um disparo por evento de verdade),
   * mas SEM esperar o evento real acontecer e SEM avaliar as condições
   * (o objetivo é ver o que as ações fariam, não simular a decisão de
   * disparar). `contactId`/`conversationId` são opcionais — passe se as
   * ações da automação dependerem de um deles (ex.: `create_task`,
   * `send_message`) para o teste ser representativo.
   */
  async test(id: string, contactId: string | undefined, conversationId: string | undefined, actorId: string) {
    const automation = await this.get(id);
    const tenantId = requireCurrentTenantId();

    const execution = await this.tenantPrisma.automationExecution.create({
      data: {
        automationId: automation.id,
        contactId: contactId ?? null,
        conversationId: conversationId ?? null,
        gatilhoDisparado: `${automation.gatilhoTipo} (teste manual)`,
        status: "pending",
      },
    });

    await this.producer.enqueueExecution(execution.id);

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "automation.test",
      entity: "Automation",
      entityId: id,
      newData: { automationExecutionId: execution.id },
    });

    return { tenantId, automationExecutionId: execution.id };
  }

  async update(id: string, dto: UpdateAutomationDto, actorId: string) {
    await this.get(id);

    if (dto.acoes !== undefined) {
      const errors = validateAutomationActions(dto.acoes);
      if (errors.length > 0) {
        throw new BadRequestException({ message: "Automação inválida.", errors });
      }
    }

    const data: Prisma.AutomationUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.tipoAutomacao !== undefined) data.tipoAutomacao = dto.tipoAutomacao;
    if (dto.cooldownMinutos !== undefined) data.cooldownMinutos = dto.cooldownMinutos;
    if (dto.gatilhoTipo !== undefined) data.gatilhoTipo = dto.gatilhoTipo;
    if (dto.condicoes !== undefined) data.condicoes = dto.condicoes as unknown as Prisma.InputJsonValue;
    if (dto.acoes !== undefined) data.acoes = dto.acoes as unknown as Prisma.InputJsonValue;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.tenantPrisma.automation.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "automation.update",
      entity: "Automation",
      entityId: id,
      newData: { status: updated.status },
    });

    return updated;
  }

  async remove(id: string, actorId: string): Promise<void> {
    const automation = await this.get(id);
    await this.tenantPrisma.automation.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "automation.remove",
      entity: "Automation",
      entityId: id,
      previousData: { nome: automation.nome },
    });
  }

  listExecutions(automationId: string) {
    return this.tenantPrisma.automationExecution.findMany({
      where: { automationId },
      orderBy: { createdAt: "desc" },
    });
  }
}
