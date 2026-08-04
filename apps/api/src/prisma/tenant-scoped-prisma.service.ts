import { Injectable } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { PrismaService } from "./prisma.service";

/**
 * Wrapper de acesso a dados que injeta `tenantId` automaticamente em toda
 * operação sobre entidades multiempresa — camada de defesa em profundidade
 * além dos guards/services (ver SECURITY.md §2). `tenantId` nunca é recebido
 * por parâmetro: é sempre lido do AsyncLocalStorage (`TenantContextInterceptor`),
 * populado a partir do JWT autenticado.
 *
 * Cobre, nesta fase, as entidades multiempresa já usadas pelos módulos de
 * Fundação (TenantUser, FeatureFlag, AuditLog). Novas entidades multiempresa
 * introduzidas em fases futuras devem ganhar seu próprio delegate aqui.
 */
@Injectable()
export class TenantScopedPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  get tenantUser() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.TenantUserFindManyArgs, "where"> & { where?: Prisma.TenantUserWhereInput } = {}) =>
        this.prisma.tenantUser.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.TenantUserFindFirstArgs, "where"> & { where?: Prisma.TenantUserWhereInput } = {}) =>
        this.prisma.tenantUser.findFirst({ ...args, where: { ...args.where, tenantId } }),

      count: (args: Omit<Prisma.TenantUserCountArgs, "where"> & { where?: Prisma.TenantUserWhereInput } = {}) =>
        this.prisma.tenantUser.count({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.TenantUserCreateArgs, "data"> & { data: Omit<Prisma.TenantUserUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.tenantUser.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.TenantUserUncheckedUpdateInput }) =>
        this.prisma.tenantUser.update({
          where: { id: args.where.id, tenantId },
          data: args.data,
        }),

      updateMany: (args: Omit<Prisma.TenantUserUpdateManyArgs, "where"> & { where?: Prisma.TenantUserWhereInput } = { data: {} }) =>
        this.prisma.tenantUser.updateMany({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get featureFlag() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.FeatureFlagFindManyArgs, "where"> & { where?: Prisma.FeatureFlagWhereInput } = {}) =>
        this.prisma.featureFlag.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.FeatureFlagFindFirstArgs, "where"> & { where?: Prisma.FeatureFlagWhereInput } = {}) =>
        this.prisma.featureFlag.findFirst({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get file() {
    const tenantId = requireCurrentTenantId();
    return {
      findFirst: (args: Omit<Prisma.FileFindFirstArgs, "where"> & { where?: Prisma.FileWhereInput } = {}) =>
        this.prisma.file.findFirst({ ...args, where: { ...args.where, tenantId } }),

      findMany: (args: Omit<Prisma.FileFindManyArgs, "where"> & { where?: Prisma.FileWhereInput } = {}) =>
        this.prisma.file.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.FileCreateArgs, "data"> & { data: Omit<Prisma.FileUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.file.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.FileUncheckedUpdateInput }) =>
        this.prisma.file.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get contact() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ContactFindManyArgs, "where"> & { where?: Prisma.ContactWhereInput } = {}) =>
        this.prisma.contact.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.ContactFindFirstArgs, "where"> & { where?: Prisma.ContactWhereInput } = {}) =>
        this.prisma.contact.findFirst({ ...args, where: { ...args.where, tenantId } }),

      count: (args: Omit<Prisma.ContactCountArgs, "where"> & { where?: Prisma.ContactWhereInput } = {}) =>
        this.prisma.contact.count({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ContactCreateArgs, "data"> & { data: Omit<Prisma.ContactUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.contact.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.ContactUncheckedUpdateInput }) =>
        this.prisma.contact.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      updateMany: (args: Omit<Prisma.ContactUpdateManyArgs, "where"> & { where?: Prisma.ContactWhereInput } = { data: {} }) =>
        this.prisma.contact.updateMany({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get contactOrigin() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ContactOriginFindManyArgs, "where"> & { where?: Prisma.ContactOriginWhereInput } = {}) =>
        this.prisma.contactOrigin.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.ContactOriginFindFirstArgs, "where"> & { where?: Prisma.ContactOriginWhereInput } = {}) =>
        this.prisma.contactOrigin.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ContactOriginCreateArgs, "data"> & { data: Omit<Prisma.ContactOriginUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.contactOrigin.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.ContactOriginUncheckedUpdateInput }) =>
        this.prisma.contactOrigin.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.contactOrigin.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get funnel() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.FunnelFindManyArgs, "where"> & { where?: Prisma.FunnelWhereInput } = {}) =>
        this.prisma.funnel.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.FunnelFindFirstArgs, "where"> & { where?: Prisma.FunnelWhereInput } = {}) =>
        this.prisma.funnel.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.FunnelCreateArgs, "data"> & { data: Omit<Prisma.FunnelUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.funnel.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.FunnelUncheckedUpdateInput }) =>
        this.prisma.funnel.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get opportunity() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.OpportunityFindManyArgs, "where"> & { where?: Prisma.OpportunityWhereInput } = {}) =>
        this.prisma.opportunity.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.OpportunityFindFirstArgs, "where"> & { where?: Prisma.OpportunityWhereInput } = {}) =>
        this.prisma.opportunity.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.OpportunityCreateArgs, "data"> & { data: Omit<Prisma.OpportunityUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.opportunity.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.OpportunityUncheckedUpdateInput }) =>
        this.prisma.opportunity.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get crmTask() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.CrmTaskFindManyArgs, "where"> & { where?: Prisma.CrmTaskWhereInput } = {}) =>
        this.prisma.crmTask.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.CrmTaskFindFirstArgs, "where"> & { where?: Prisma.CrmTaskWhereInput } = {}) =>
        this.prisma.crmTask.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.CrmTaskCreateArgs, "data"> & { data: Omit<Prisma.CrmTaskUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.crmTask.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.CrmTaskUncheckedUpdateInput }) =>
        this.prisma.crmTask.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      count: (args: Omit<Prisma.CrmTaskCountArgs, "where"> & { where?: Prisma.CrmTaskWhereInput } = {}) =>
        this.prisma.crmTask.count({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get crmTaskType() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.CrmTaskTypeFindManyArgs, "where"> & { where?: Prisma.CrmTaskTypeWhereInput } = {}) =>
        this.prisma.crmTaskType.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.CrmTaskTypeFindFirstArgs, "where"> & { where?: Prisma.CrmTaskTypeWhereInput } = {}) =>
        this.prisma.crmTaskType.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.CrmTaskTypeCreateArgs, "data"> & { data: Omit<Prisma.CrmTaskTypeUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.crmTaskType.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.CrmTaskTypeUncheckedUpdateInput }) =>
        this.prisma.crmTaskType.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.crmTaskType.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get opportunityStageHistory() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (
        args: Omit<Prisma.OpportunityStageHistoryFindManyArgs, "where"> & { where?: Prisma.OpportunityStageHistoryWhereInput } = {},
      ) => this.prisma.opportunityStageHistory.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (
        args: Omit<Prisma.OpportunityStageHistoryFindFirstArgs, "where"> & { where?: Prisma.OpportunityStageHistoryWhereInput } = {},
      ) => this.prisma.opportunityStageHistory.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (
        args: Omit<Prisma.OpportunityStageHistoryCreateArgs, "data"> & {
          data: Omit<Prisma.OpportunityStageHistoryUncheckedCreateInput, "tenantId">;
        },
      ) => this.prisma.opportunityStageHistory.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.OpportunityStageHistoryUncheckedUpdateInput }) =>
        this.prisma.opportunityStageHistory.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get deduplicationRule() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.DeduplicationRuleFindManyArgs, "where"> & { where?: Prisma.DeduplicationRuleWhereInput } = {}) =>
        this.prisma.deduplicationRule.findMany({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get whatsAppNumber() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.WhatsAppNumberFindManyArgs, "where"> & { where?: Prisma.WhatsAppNumberWhereInput } = {}) =>
        this.prisma.whatsAppNumber.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.WhatsAppNumberFindFirstArgs, "where"> & { where?: Prisma.WhatsAppNumberWhereInput } = {}) =>
        this.prisma.whatsAppNumber.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.WhatsAppNumberCreateArgs, "data"> & { data: Omit<Prisma.WhatsAppNumberUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.whatsAppNumber.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.WhatsAppNumberUncheckedUpdateInput }) =>
        this.prisma.whatsAppNumber.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get whatsAppTemplate() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.WhatsAppTemplateFindManyArgs, "where"> & { where?: Prisma.WhatsAppTemplateWhereInput } = {}) =>
        this.prisma.whatsAppTemplate.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.WhatsAppTemplateFindFirstArgs, "where"> & { where?: Prisma.WhatsAppTemplateWhereInput } = {}) =>
        this.prisma.whatsAppTemplate.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.WhatsAppTemplateCreateArgs, "data"> & { data: Omit<Prisma.WhatsAppTemplateUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.whatsAppTemplate.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.WhatsAppTemplateUncheckedUpdateInput }) =>
        this.prisma.whatsAppTemplate.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get riskAcceptance() {
    const tenantId = requireCurrentTenantId();
    return {
      findFirst: (args: Omit<Prisma.RiskAcceptanceFindFirstArgs, "where"> & { where?: Prisma.RiskAcceptanceWhereInput } = {}) =>
        this.prisma.riskAcceptance.findFirst({ ...args, where: { ...args.where, tenantId } }),

      findMany: (args: Omit<Prisma.RiskAcceptanceFindManyArgs, "where"> & { where?: Prisma.RiskAcceptanceWhereInput } = {}) =>
        this.prisma.riskAcceptance.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.RiskAcceptanceCreateArgs, "data"> & { data: Omit<Prisma.RiskAcceptanceUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.riskAcceptance.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get conversation() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ConversationFindManyArgs, "where"> & { where?: Prisma.ConversationWhereInput } = {}) =>
        this.prisma.conversation.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.ConversationFindFirstArgs, "where"> & { where?: Prisma.ConversationWhereInput } = {}) =>
        this.prisma.conversation.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ConversationCreateArgs, "data"> & { data: Omit<Prisma.ConversationUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.conversation.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.ConversationUncheckedUpdateInput }) =>
        this.prisma.conversation.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get message() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.MessageFindManyArgs, "where"> & { where?: Prisma.MessageWhereInput } = {}) =>
        this.prisma.message.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.MessageCreateArgs, "data"> & { data: Omit<Prisma.MessageUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.message.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get team() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.TeamFindManyArgs, "where"> & { where?: Prisma.TeamWhereInput } = {}) =>
        this.prisma.team.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.TeamFindFirstArgs, "where"> & { where?: Prisma.TeamWhereInput } = {}) =>
        this.prisma.team.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.TeamCreateArgs, "data"> & { data: Omit<Prisma.TeamUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.team.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.TeamUncheckedUpdateInput }) =>
        this.prisma.team.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.team.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get queue() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.QueueFindManyArgs, "where"> & { where?: Prisma.QueueWhereInput } = {}) =>
        this.prisma.queue.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.QueueFindFirstArgs, "where"> & { where?: Prisma.QueueWhereInput } = {}) =>
        this.prisma.queue.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.QueueCreateArgs, "data"> & { data: Omit<Prisma.QueueUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.queue.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.QueueUncheckedUpdateInput }) =>
        this.prisma.queue.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.queue.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get businessHours() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.BusinessHoursFindManyArgs, "where"> & { where?: Prisma.BusinessHoursWhereInput } = {}) =>
        this.prisma.businessHours.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.BusinessHoursCreateArgs, "data"> & { data: Omit<Prisma.BusinessHoursUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.businessHours.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get conversationEvent() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ConversationEventFindManyArgs, "where"> & { where?: Prisma.ConversationEventWhereInput } = {}) =>
        this.prisma.conversationEvent.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ConversationEventCreateArgs, "data"> & { data: Omit<Prisma.ConversationEventUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.conversationEvent.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get chatbotFlow() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ChatbotFlowFindManyArgs, "where"> & { where?: Prisma.ChatbotFlowWhereInput } = {}) =>
        this.prisma.chatbotFlow.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.ChatbotFlowFindFirstArgs, "where"> & { where?: Prisma.ChatbotFlowWhereInput } = {}) =>
        this.prisma.chatbotFlow.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ChatbotFlowCreateArgs, "data"> & { data: Omit<Prisma.ChatbotFlowUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.chatbotFlow.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.ChatbotFlowUncheckedUpdateInput }) =>
        this.prisma.chatbotFlow.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.chatbotFlow.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get chatbotExecution() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.ChatbotExecutionFindManyArgs, "where"> & { where?: Prisma.ChatbotExecutionWhereInput } = {}) =>
        this.prisma.chatbotExecution.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.ChatbotExecutionFindFirstArgs, "where"> & { where?: Prisma.ChatbotExecutionWhereInput } = {}) =>
        this.prisma.chatbotExecution.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.ChatbotExecutionCreateArgs, "data"> & { data: Omit<Prisma.ChatbotExecutionUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.chatbotExecution.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.ChatbotExecutionUncheckedUpdateInput }) =>
        this.prisma.chatbotExecution.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get knowledgeBaseItem() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.KnowledgeBaseItemFindManyArgs, "where"> & { where?: Prisma.KnowledgeBaseItemWhereInput } = {}) =>
        this.prisma.knowledgeBaseItem.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.KnowledgeBaseItemFindFirstArgs, "where"> & { where?: Prisma.KnowledgeBaseItemWhereInput } = {}) =>
        this.prisma.knowledgeBaseItem.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.KnowledgeBaseItemCreateArgs, "data"> & { data: Omit<Prisma.KnowledgeBaseItemUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.knowledgeBaseItem.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.KnowledgeBaseItemUncheckedUpdateInput }) =>
        this.prisma.knowledgeBaseItem.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      delete: (args: { where: { id: string } }) => this.prisma.knowledgeBaseItem.delete({ where: { id: args.where.id, tenantId } }),
    };
  }

  get tenantAiCredential() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.TenantAiCredentialFindManyArgs, "where"> & { where?: Prisma.TenantAiCredentialWhereInput } = {}) =>
        this.prisma.tenantAiCredential.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.TenantAiCredentialFindFirstArgs, "where"> & { where?: Prisma.TenantAiCredentialWhereInput } = {}) =>
        this.prisma.tenantAiCredential.findFirst({ ...args, where: { ...args.where, tenantId } }),

      upsert: (args: { provider: string; encryptedKey: string }) =>
        this.prisma.tenantAiCredential.upsert({
          where: { tenantId_provider: { tenantId, provider: args.provider } },
          create: { tenantId, provider: args.provider, encryptedKey: args.encryptedKey },
          update: { encryptedKey: args.encryptedKey },
        }),

      delete: (provider: string) =>
        this.prisma.tenantAiCredential.deleteMany({ where: { tenantId, provider } }),
    };
  }

  get automation() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.AutomationFindManyArgs, "where"> & { where?: Prisma.AutomationWhereInput } = {}) =>
        this.prisma.automation.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.AutomationFindFirstArgs, "where"> & { where?: Prisma.AutomationWhereInput } = {}) =>
        this.prisma.automation.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.AutomationCreateArgs, "data"> & { data: Omit<Prisma.AutomationUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.automation.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.AutomationUncheckedUpdateInput }) =>
        this.prisma.automation.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get automationExecution() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.AutomationExecutionFindManyArgs, "where"> & { where?: Prisma.AutomationExecutionWhereInput } = {}) =>
        this.prisma.automationExecution.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.AutomationExecutionFindFirstArgs, "where"> & { where?: Prisma.AutomationExecutionWhereInput } = {}) =>
        this.prisma.automationExecution.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.AutomationExecutionCreateArgs, "data"> & { data: Omit<Prisma.AutomationExecutionUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.automationExecution.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get followUpSchedule() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.FollowUpScheduleFindManyArgs, "where"> & { where?: Prisma.FollowUpScheduleWhereInput } = {}) =>
        this.prisma.followUpSchedule.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.FollowUpScheduleCreateArgs, "data"> & { data: Omit<Prisma.FollowUpScheduleUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.followUpSchedule.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get invoice() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.InvoiceFindManyArgs, "where"> & { where?: Prisma.InvoiceWhereInput } = {}) =>
        this.prisma.invoice.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.InvoiceFindFirstArgs, "where"> & { where?: Prisma.InvoiceWhereInput } = {}) =>
        this.prisma.invoice.findFirst({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get conversationEvaluation() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (
        args: Omit<Prisma.ConversationEvaluationFindManyArgs, "where"> & { where?: Prisma.ConversationEvaluationWhereInput } = {},
      ) => this.prisma.conversationEvaluation.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (
        args: Omit<Prisma.ConversationEvaluationCreateArgs, "data"> & {
          data: Omit<Prisma.ConversationEvaluationUncheckedCreateInput, "tenantId">;
        },
      ) => this.prisma.conversationEvaluation.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get notification() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.NotificationFindManyArgs, "where"> & { where?: Prisma.NotificationWhereInput } = {}) =>
        this.prisma.notification.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.NotificationFindFirstArgs, "where"> & { where?: Prisma.NotificationWhereInput } = {}) =>
        this.prisma.notification.findFirst({ ...args, where: { ...args.where, tenantId } }),

      count: (args: Omit<Prisma.NotificationCountArgs, "where"> & { where?: Prisma.NotificationWhereInput } = {}) =>
        this.prisma.notification.count({ ...args, where: { ...args.where, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.NotificationUncheckedUpdateInput }) =>
        this.prisma.notification.update({ where: { id: args.where.id, tenantId }, data: args.data }),

      updateMany: (args: Omit<Prisma.NotificationUpdateManyArgs, "where"> & { where?: Prisma.NotificationWhereInput } = { data: {} }) =>
        this.prisma.notification.updateMany({ ...args, where: { ...args.where, tenantId } }),
    };
  }

  get auditLog() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.AuditLogFindManyArgs, "where"> & { where?: Prisma.AuditLogWhereInput } = {}) =>
        this.prisma.auditLog.findMany({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.AuditLogCreateArgs, "data"> & { data: Omit<Prisma.AuditLogUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.auditLog.create({ ...args, data: { ...args.data, tenantId } }),
    };
  }

  get quickMessage() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (args: Omit<Prisma.QuickMessageFindManyArgs, "where"> & { where?: Prisma.QuickMessageWhereInput } = {}) =>
        this.prisma.quickMessage.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (args: Omit<Prisma.QuickMessageFindFirstArgs, "where"> & { where?: Prisma.QuickMessageWhereInput } = {}) =>
        this.prisma.quickMessage.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (args: Omit<Prisma.QuickMessageCreateArgs, "data"> & { data: Omit<Prisma.QuickMessageUncheckedCreateInput, "tenantId"> }) =>
        this.prisma.quickMessage.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.QuickMessageUncheckedUpdateInput }) =>
        this.prisma.quickMessage.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }

  get customFieldDefinition() {
    const tenantId = requireCurrentTenantId();
    return {
      findMany: (
        args: Omit<Prisma.CustomFieldDefinitionFindManyArgs, "where"> & { where?: Prisma.CustomFieldDefinitionWhereInput } = {},
      ) => this.prisma.customFieldDefinition.findMany({ ...args, where: { ...args.where, tenantId } }),

      findFirst: (
        args: Omit<Prisma.CustomFieldDefinitionFindFirstArgs, "where"> & { where?: Prisma.CustomFieldDefinitionWhereInput } = {},
      ) => this.prisma.customFieldDefinition.findFirst({ ...args, where: { ...args.where, tenantId } }),

      create: (
        args: Omit<Prisma.CustomFieldDefinitionCreateArgs, "data"> & {
          data: Omit<Prisma.CustomFieldDefinitionUncheckedCreateInput, "tenantId">;
        },
      ) => this.prisma.customFieldDefinition.create({ ...args, data: { ...args.data, tenantId } }),

      update: (args: { where: { id: string }; data: Prisma.CustomFieldDefinitionUncheckedUpdateInput }) =>
        this.prisma.customFieldDefinition.update({ where: { id: args.where.id, tenantId }, data: args.data }),
    };
  }
}
