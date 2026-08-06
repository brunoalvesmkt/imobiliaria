import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { buildAutomationCatalog, validateAutomationActions, validateTriggerParams, type AutomationAction } from "./automation-definition.types";
import { AUTOMATION_TEMPLATES, buildAutomationTemplateCatalog } from "./automation-templates";
import { AutomationProducer } from "./automation.producer";
import { AutomationProcessor } from "./automation.processor";
import type { CreateAutomationDto } from "./dto/create-automation.dto";
import type { UpdateAutomationDto } from "./dto/update-automation.dto";

@Injectable()
export class AutomationsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly producer: AutomationProducer,
    private readonly processor: AutomationProcessor,
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

  /** Biblioteca de modelos prontos (Fase D), já filtrada pelos módulos ativos do tenant. */
  async listTemplates() {
    const flags = await this.tenantPrisma.featureFlag.findMany({ where: { enabled: true } });
    const activeModules = new Set(flags.map((f) => f.module));
    return buildAutomationTemplateCatalog(activeModules);
  }

  /**
   * Ativa um modelo pronto — monta o DTO a partir do modelo estático e chama `create()` já
   * existente, então herda a mesma validação/auditoria/geração de `webhookSecret`. `nomeDesejado`
   * vem do frontend já traduzido (o nome de exibição do modelo mora só na i18n — ver
   * `automation-templates.ts` — o backend não sabe o texto em português/inglês/espanhol). Se já
   * existir uma automação com esse nome (ex.: modelo ativado antes e de novo), sufixa com um
   * número, mesmo tratamento que outros módulos já fazem para nomes únicos.
   */
  async activateTemplate(templateId: string, actorId: string, nomeDesejado?: string) {
    const template = AUTOMATION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      throw new NotFoundException("Modelo não encontrado.");
    }

    let nome = nomeDesejado?.trim() || templateId;
    let suffix = 1;
    while (await this.tenantPrisma.automation.findFirst({ where: { nome } })) {
      suffix += 1;
      nome = `${nomeDesejado?.trim() || templateId} (${suffix})`;
    }

    return this.create(
      {
        nome,
        gatilhoTipo: template.gatilhoTipo,
        ...(template.gatilhoParametros ? { gatilhoParametros: template.gatilhoParametros } : {}),
        acoes: template.acoes,
      },
      actorId,
    );
  }

  async get(id: string) {
    const automation = await this.tenantPrisma.automation.findFirst({ where: { id } });
    if (!automation) {
      throw new NotFoundException("Automação não encontrada.");
    }
    return automation;
  }

  async create(dto: CreateAutomationDto, actorId: string) {
    const errors = [...validateAutomationActions(dto.acoes), ...validateTriggerParams(dto.gatilhoTipo, dto.gatilhoParametros)];
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
        gatilhoParametros: (dto.gatilhoParametros ?? null) as unknown as Prisma.InputJsonValue,
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

  /**
   * Teste simulado (Fase D) — diferente de `test()` (Fase 28, que dispara uma execução real pela
   * fila), roda as ações síncrono na própria resposta HTTP e NENHUMA delas tem efeito real (sem
   * mensagem enviada, sem `CrmTask`/`Opportunity` gravada, sem webhook chamado — ver
   * `AutomationProcessor.simulateActions`). Não cria `AutomationExecution` nem passa pela fila: não
   * é uma execução de verdade, é só "o que aconteceria". Diferente de `resolveContactId` do
   * processor (que cria um `Contact` novo se preciso), aqui o `contactId` é só o que foi informado
   * — criar dado de verdade durante um teste "sem efeitos" seria uma contradição.
   */
  async simulate(id: string, contactId: string | undefined, conversationId: string | undefined) {
    const automation = await this.get(id);
    const acoes = automation.acoes as unknown as AutomationAction[];

    const passos = await this.processor.simulateActions(
      automation.tenantId,
      acoes,
      automation.webhookSecret,
      contactId ?? null,
      conversationId ?? null,
      automation.id,
      automation.gatilhoTipo,
    );

    return { passos };
  }

  async update(id: string, dto: UpdateAutomationDto, actorId: string) {
    const current = await this.get(id);

    if (dto.acoes !== undefined) {
      const errors = validateAutomationActions(dto.acoes);
      if (errors.length > 0) {
        throw new BadRequestException({ message: "Automação inválida.", errors });
      }
    }

    if (dto.gatilhoTipo !== undefined || dto.gatilhoParametros !== undefined) {
      const effectiveGatilhoTipo = dto.gatilhoTipo ?? current.gatilhoTipo;
      const effectiveParams = dto.gatilhoParametros !== undefined ? dto.gatilhoParametros : current.gatilhoParametros;
      const errors = validateTriggerParams(effectiveGatilhoTipo as Parameters<typeof validateTriggerParams>[0], effectiveParams);
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
    if (dto.gatilhoParametros !== undefined) data.gatilhoParametros = dto.gatilhoParametros as unknown as Prisma.InputJsonValue;
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
