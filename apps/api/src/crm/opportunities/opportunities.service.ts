import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { FollowUpsService } from "../../automation/followups.service";
import { CrmVisibilityConfigService } from "../crm-visibility-config.service";
import type { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import type { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import type { MoveStageDto } from "./dto/move-stage.dto";
import type { CloseOpportunityDto } from "./dto/close-opportunity.dto";
import type { TransferResponsavelDto } from "./dto/transfer-responsavel.dto";

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly followUps: FollowUpsService,
    private readonly visibilityConfig: CrmVisibilityConfigService,
  ) {}

  /**
   * "Administrador", pelo mesmo critério já usado em `tenant-users.service.ts`
   * (hasPermission): papel com a permissão `crm:administer` — não um nome de
   * papel fixo. Quem tem essa permissão vê/edita qualquer oportunidade,
   * independente de quem seja o responsável.
   */
  private async canSeeAll(roleId: string | undefined): Promise<boolean> {
    if (!roleId) return false;
    const permission = await this.prisma.permission.findFirst({ where: { roleId, module: "crm", action: "administer" } });
    return !!permission;
  }

  /** Além das próprias, se o usuário deve ver também as oportunidades sem responsável — depende de `CrmVisibilityConfigService` (padrão: todos veem; opcionalmente restrito a uma lista). */
  private async canSeeUnassigned(actorId: string | undefined): Promise<boolean> {
    if (!actorId) return false;
    const config = await this.visibilityConfig.get();
    return config.semResponsavelModo === "todos" || config.semResponsavelUsuarioIds.includes(actorId);
  }

  /**
   * Opções para o seletor de responsável na tela de detalhes — usuários ativos cujo papel tem
   * ao menos uma permissão no módulo "crm" (não existe controle de acesso por funil específico
   * neste RBAC, só por módulo inteiro — ver PERMISSIONS_MATRIX.md). Endpoint próprio, gated por
   * "crm":"view", em vez de reaproveitar `GET /tenant-users` (gated por "configuracoes":"view",
   * permissão que um usuário comum do CRM não necessariamente tem).
   */
  async listResponsavelOptions() {
    const tenantId = requireCurrentTenantId();
    return this.prisma.tenantUser.findMany({
      where: { tenantId, deletedAt: null, status: "active", role: { permissions: { some: { module: "crm" } } } },
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
    });
  }

  async list(funnelId?: string, stageId?: string, actorId?: string, roleId?: string) {
    const tenantId = requireCurrentTenantId();
    const where: Prisma.OpportunityWhereInput = { deletedAt: null, tenantId };
    if (funnelId) where.funnelId = funnelId;
    if (stageId) where.stageId = stageId;

    // Visibilidade por responsável: quem não tem crm:administer só vê as próprias oportunidades
    // (mais as sem responsável, a depender de CrmVisibilityConfigService).
    if (actorId && !(await this.canSeeAll(roleId))) {
      where.OR = (await this.canSeeUnassigned(actorId))
        ? [{ responsavelId: actorId }, { responsavelId: null }]
        : [{ responsavelId: actorId }];
    }
    // Consulta direta ao PrismaService (em vez do wrapper tenantPrisma.opportunity, cujo
    // tipo fixo de retorno não preserva a relação "include" abaixo) — tenantId já filtrado acima.
    const opportunities = await this.prisma.opportunity.findMany({
      where,
      orderBy: [{ ordem: "asc" }, { createdAt: "desc" }],
      include: {
        contact: { select: { id: true, nome: true, whatsapp: true } },
        // Linha "aberta" (exitedAt nulo) do histórico é a etapa atual — usada pelo
        // Kanban para mostrar há quanto tempo a oportunidade está na etapa em que se encontra.
        stageHistory: { where: { exitedAt: null }, orderBy: { enteredAt: "desc" }, take: 1, select: { enteredAt: true } },
      },
    });

    return opportunities.map(({ stageHistory, ...o }) => ({
      ...o,
      stageEnteredAt: stageHistory[0]?.enteredAt ?? o.createdAt,
    }));
  }

  /**
   * Tela de detalhes da oportunidade (documento "Detalhes da oportunidade no funil") — além dos
   * dados básicos, inclui o contato com telefones/e-mails/origem, o responsável atual e o
   * histórico completo de etapas (`stageHistory`, mais antiga primeiro) para o feed de
   * movimentações. `tasks` fica de fora do include: a tela busca via `GET /crm/tasks?opportunityId=`
   * (mesmo endpoint que já alimenta a aba geral de Tarefas), evitando duas fontes de verdade.
   */
  async get(id: string, actorId?: string, roleId?: string) {
    const tenantId = requireCurrentTenantId();
    // Consulta direta ao PrismaService (mesmo motivo de list()): o wrapper tenantPrisma.opportunity
    // tem tipo de retorno fixo que não preserva as relações do "include" abaixo.
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        contact: { include: { phones: true, emails: true, origemRef: true } },
        stage: true,
        funnel: true,
        responsavel: { select: { id: true, nome: true, email: true, status: true } },
        stageHistory: { orderBy: { enteredAt: "asc" }, include: { stage: { select: { id: true, nome: true } } } },
      },
    });
    if (!opportunity) {
      throw new NotFoundException("Oportunidade não encontrada.");
    }

    // Visibilidade por responsável (mesma regra de list()) — tratada como "não encontrada" em vez
    // de 403 para não confirmar a um usuário sem acesso que aquele id existe.
    if (actorId !== undefined && !(await this.canSeeAll(roleId))) {
      const isOwner = opportunity.responsavelId === actorId;
      const isUnassignedAndVisible = opportunity.responsavelId === null && (await this.canSeeUnassigned(actorId));
      if (!isOwner && !isUnassignedAndVisible) {
        throw new NotFoundException("Oportunidade não encontrada.");
      }
    }

    return opportunity;
  }

  async create(dto: CreateOpportunityDto, actorId: string) {
    const tenantId = requireCurrentTenantId();

    const [contact, stage] = await Promise.all([
      this.tenantPrisma.contact.findFirst({ where: { id: dto.contactId, deletedAt: null } }),
      this.prisma.funnelStage.findFirst({
        where: { id: dto.stageId, funnelId: dto.funnelId, funnel: { tenantId } },
      }),
    ]);
    if (!contact) {
      throw new NotFoundException("Contato não encontrado.");
    }
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const opportunity = await this.tenantPrisma.opportunity.create({
      data: {
        contactId: dto.contactId,
        funnelId: dto.funnelId,
        stageId: dto.stageId,
        valor: dto.valor ?? null,
        probabilidade: stage.probabilidade,
        produto: dto.produto ?? null,
        servico: dto.servico ?? null,
        // Responsável inicial (documento, item 8): o próprio usuário que criou a oportunidade,
        // a menos que já tenha informado outro explicitamente.
        responsavelId: dto.responsavelId ?? actorId,
        previsaoFechamento: dto.previsaoFechamento ? new Date(dto.previsaoFechamento) : null,
        origem: dto.origem ?? null,
        campanha: dto.campanha ?? null,
        observacoes: dto.observacoes ?? null,
      },
    });

    await this.tenantPrisma.opportunityStageHistory.create({
      data: { opportunityId: opportunity.id, stageId: opportunity.stageId },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.create",
      entity: "Opportunity",
      entityId: opportunity.id,
      newData: { contactId: opportunity.contactId, stageId: opportunity.stageId },
    });

    return opportunity;
  }

  async update(id: string, dto: UpdateOpportunityDto, actorId: string, roleId?: string) {
    await this.get(id, actorId, roleId);

    const data: Prisma.OpportunityUncheckedUpdateInput = {};
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.produto !== undefined) data.produto = dto.produto;
    if (dto.servico !== undefined) data.servico = dto.servico;
    if (dto.responsavelId !== undefined) data.responsavelId = dto.responsavelId;
    if (dto.previsaoFechamento !== undefined) data.previsaoFechamento = new Date(dto.previsaoFechamento);
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;

    await this.tenantPrisma.opportunity.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.update",
      entity: "Opportunity",
      entityId: id,
    });

    // Devolve com os mesmos includes de get() (contato, etapa, funil, responsável, histórico) —
    // o frontend da tela de detalhes grava a resposta direto no cache da query de detalhe
    // (queryClient.setQueryData), então um retorno "raso" (só as colunas da tabela) quebraria a
    // renderização ao sobrescrever os dados aninhados já carregados.
    return this.get(id, actorId, roleId);
  }

  /**
   * Transferência de responsável (documento, itens 9-11) — endpoint dedicado (em vez de deixar
   * só no `update()` genérico) para validar que o novo responsável é um usuário ativo do tenant
   * antes de gravar, e para deixar uma trilha de auditoria específica com os nomes de "antes" e
   * "depois" (mesmo espírito de `InboxService.transfer`, que também audita a troca de
   * responsável de uma conversa separadamente do resto dos campos).
   */
  async transferResponsavel(id: string, dto: TransferResponsavelDto, actorId: string, roleId?: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.get(id, actorId, roleId);

    let novoResponsavel: { id: string; nome: string } | null = null;
    if (dto.responsavelId) {
      const user = await this.prisma.tenantUser.findFirst({
        where: { id: dto.responsavelId, tenantId, deletedAt: null, status: "active" },
      });
      if (!user) {
        throw new NotFoundException("Usuário não encontrado, inativo ou sem acesso a esta empresa.");
      }
      novoResponsavel = { id: user.id, nome: user.nome };
    }

    await this.tenantPrisma.opportunity.update({
      where: { id },
      data: { responsavelId: novoResponsavel?.id ?? null },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.responsavel_changed",
      entity: "Opportunity",
      entityId: id,
      previousData: { responsavelId: opportunity.responsavelId, responsavelNome: opportunity.responsavel?.nome ?? null },
      newData: { responsavelId: novoResponsavel?.id ?? null, responsavelNome: novoResponsavel?.nome ?? null },
    });

    this.domainEvents.emit("opportunity.responsavel_changed", {
      tenantId,
      contactId: opportunity.contactId,
      opportunityId: id,
      data: { opportunityId: id, responsavelId: novoResponsavel?.id ?? null, responsavelIdAnterior: opportunity.responsavelId },
    });

    // Ver comentário em update() — o frontend grava o retorno direto no cache da query de
    // detalhe, então precisa vir com os mesmos includes de get().
    return this.get(id, actorId, roleId);
  }

  async moveStage(id: string, dto: MoveStageDto, actorId: string, roleId?: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.get(id, actorId, roleId);

    if (opportunity.status !== "open") {
      throw new BadRequestException("Oportunidade já encerrada (ganha/perdida) não pode mudar de etapa.");
    }

    const stage = await this.prisma.funnelStage.findFirst({
      where: { id: dto.stageId, funnelId: opportunity.funnelId, funnel: { tenantId } },
    });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada neste funil.");
    }

    const updated = await this.tenantPrisma.opportunity.update({
      where: { id },
      data: { stageId: dto.stageId, probabilidade: stage.probabilidade },
    });

    await this.closeOpenStageHistory(id);
    await this.tenantPrisma.opportunityStageHistory.create({ data: { opportunityId: id, stageId: dto.stageId } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.stage_changed",
      entity: "Opportunity",
      entityId: id,
      previousData: { stageId: opportunity.stageId },
      newData: { stageId: dto.stageId },
    });

    this.domainEvents.emit("opportunity.stage_changed", {
      tenantId,
      contactId: opportunity.contactId,
      opportunityId: id,
      data: { opportunityId: id, stageId: dto.stageId, stageIdAnterior: opportunity.stageId },
    });

    return updated;
  }

  /**
   * Reordena as oportunidades dentro de uma mesma etapa do Kanban (Fase 27)
   * — recebe a lista de ids na ordem final desejada e grava `ordem` como o
   * índice de cada uma. Não muda a etapa de nenhuma oportunidade (isso é
   * `moveStage`) — só a posição visual dentro da coluna atual.
   */
  async reorder(stageId: string, orderedIds: string[], actorId: string) {
    const tenantId = requireCurrentTenantId();
    const stage = await this.prisma.funnelStage.findFirst({ where: { id: stageId, funnel: { tenantId } } });
    if (!stage) {
      throw new NotFoundException("Etapa não encontrada.");
    }

    const opportunities = await this.tenantPrisma.opportunity.findMany({ where: { stageId, deletedAt: null } });
    const validIds = new Set(opportunities.map((o) => o.id));
    const idsToReorder = orderedIds.filter((id) => validIds.has(id));
    if (idsToReorder.length !== opportunities.length) {
      throw new BadRequestException("A lista de reordenação precisa incluir todas as oportunidades desta etapa.");
    }

    await this.prisma.$transaction(
      idsToReorder.map((id, index) => this.prisma.opportunity.update({ where: { id, tenantId }, data: { ordem: index } })),
    );

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.reorder",
      entity: "FunnelStage",
      entityId: stageId,
      newData: { orderedIds: idsToReorder },
    });

    return { status: "ok" as const };
  }

  async close(id: string, dto: CloseOpportunityDto, actorId: string, roleId?: string) {
    const tenantId = requireCurrentTenantId();
    const opportunity = await this.get(id, actorId, roleId);
    if (opportunity.status !== "open") {
      throw new BadRequestException("Oportunidade já está encerrada.");
    }

    const now = new Date();
    const data: Prisma.OpportunityUncheckedUpdateInput =
      dto.resultado === "won"
        ? { status: "won", motivoGanho: dto.motivo ?? null, wonAt: now }
        : { status: "lost", motivoPerda: dto.motivo ?? null, lostAt: now };

    const updated = await this.tenantPrisma.opportunity.update({ where: { id }, data });
    await this.closeOpenStageHistory(id, now);

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: dto.resultado === "won" ? "opportunity.won" : "opportunity.lost",
      entity: "Opportunity",
      entityId: id,
      newData: { motivo: dto.motivo },
    });

    this.domainEvents.emit(dto.resultado === "won" ? "opportunity.won" : "opportunity.lost", {
      tenantId,
      contactId: opportunity.contactId,
      opportunityId: id,
      data: { opportunityId: id, motivo: dto.motivo, valor: opportunity.valor ? Number(opportunity.valor) : undefined },
    });

    // Venda concluída ou oportunidade perdida cancela follow-ups pendentes ligados a este contato.
    await this.followUps.cancelByContact(opportunity.contactId, dto.resultado === "won" ? "opportunity_won" : "opportunity_lost");

    return updated;
  }

  /** Exclusão (soft delete) — gated por "crm":"delete" no controller, permissão que só o papel Administrador tem por padrão. */
  async remove(id: string, actorId: string, roleId?: string): Promise<void> {
    await this.get(id, actorId, roleId);
    await this.tenantPrisma.opportunity.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "opportunity.remove",
      entity: "Opportunity",
      entityId: id,
    });
  }

  /** Fecha a linha de histórico "aberta" (sem exitedAt) da etapa atual — chamado ao mudar de etapa ou encerrar. */
  private async closeOpenStageHistory(opportunityId: string, at: Date = new Date()): Promise<void> {
    const open = await this.tenantPrisma.opportunityStageHistory.findFirst({
      where: { opportunityId, exitedAt: null },
      orderBy: { enteredAt: "desc" },
    });
    if (open) {
      await this.tenantPrisma.opportunityStageHistory.update({ where: { id: open.id }, data: { exitedAt: at } });
    }
  }
}
