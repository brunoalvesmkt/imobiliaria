import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { ModuleActiveGuard } from "../common/modules/module-active.guard";
import { RequireModule } from "../common/modules/require-module.decorator";
import { ReportsService } from "./reports.service";
import { DateRangeDto } from "./dto/date-range.dto";
import { ContactsExportDto } from "./dto/contacts-export.dto";

/**
 * "Início" e "Relatórios" são sempre disponíveis (não comercializados
 * separadamente, ver MODULE_DEPENDENCIES.md §1) — por isso nenhuma rota
 * aqui usa `ModuleActiveGuard("relatorios")` (não existe esse FeatureFlag).
 * Cada relatório por módulo, no entanto, exige o módulo correspondente
 * ativo — só o dashboard e o financeiro ficam de fora dessa checagem.
 */
@Controller("reports")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("dashboard")
  dashboard() {
    return this.service.dashboard();
  }

  @Get("crm")
  @RequireModule("crm")
  @RequirePermission("relatorios", "view")
  crm(@Query() dto: DateRangeDto) {
    return this.service.crm(dto);
  }

  @Get("whatsapp")
  @RequireModule("whatsapp")
  @RequirePermission("relatorios", "view")
  whatsapp(@Query() dto: DateRangeDto) {
    return this.service.whatsapp(dto);
  }

  @Get("atendimento")
  @RequireModule("atendimento")
  @RequirePermission("relatorios", "view")
  atendimento(@Query() dto: DateRangeDto) {
    return this.service.atendimento(dto);
  }

  @Get("chatbot")
  @RequireModule("chatbot")
  @RequirePermission("relatorios", "view")
  chatbot(@Query() dto: DateRangeDto) {
    return this.service.chatbot(dto);
  }

  @Get("automacao")
  @RequireModule("automacao")
  @RequirePermission("relatorios", "view")
  automacao(@Query() dto: DateRangeDto) {
    return this.service.automacao(dto);
  }

  @Get("financeiro")
  @RequirePermission("relatorios", "view")
  financeiro(@Query() dto: DateRangeDto) {
    return this.service.financeiro(dto);
  }

  @Get("qualidade")
  @RequireModule("qualidade_ia")
  @RequirePermission("relatorios", "view")
  qualidade(@Query() dto: DateRangeDto) {
    return this.service.qualidade(dto);
  }

  @Get("export/invoices")
  @RequirePermission("relatorios", "export")
  async exportInvoices(@Res() res: Response) {
    const csv = await this.service.exportInvoicesCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="faturas.csv"');
    res.send(csv);
  }

  @Get("export/invoices.xlsx")
  @RequirePermission("relatorios", "export")
  async exportInvoicesXlsx(@Res() res: Response) {
    const buffer = await this.service.exportInvoicesXlsx();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="faturas.xlsx"');
    res.send(buffer);
  }

  @Get("export/invoices.pdf")
  @RequirePermission("relatorios", "export")
  async exportInvoicesPdf(@Res() res: Response) {
    const buffer = await this.service.exportInvoicesPdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="faturas.pdf"');
    res.send(buffer);
  }

  @Get("export/opportunities")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportOpportunities(@Res() res: Response) {
    const csv = await this.service.exportOpportunitiesCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="oportunidades.csv"');
    res.send(csv);
  }

  @Get("export/opportunities.xlsx")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportOpportunitiesXlsx(@Res() res: Response) {
    const buffer = await this.service.exportOpportunitiesXlsx();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="oportunidades.xlsx"');
    res.send(buffer);
  }

  @Get("export/opportunities.pdf")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportOpportunitiesPdf(@Res() res: Response) {
    const buffer = await this.service.exportOpportunitiesPdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="oportunidades.pdf"');
    res.send(buffer);
  }

  @Get("export/contacts")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportContacts(@Query() dto: ContactsExportDto, @Res() res: Response) {
    const csv = await this.service.exportContactsCsv({ allPhones: dto.allPhones === "true", allEmails: dto.allEmails === "true" });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="contatos.csv"');
    res.send(csv);
  }

  @Get("export/contacts.xlsx")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportContactsXlsx(@Query() dto: ContactsExportDto, @Res() res: Response) {
    const buffer = await this.service.exportContactsXlsx({ allPhones: dto.allPhones === "true", allEmails: dto.allEmails === "true" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="contatos.xlsx"');
    res.send(buffer);
  }

  @Get("export/contacts.pdf")
  @RequireModule("crm")
  @RequirePermission("relatorios", "export")
  async exportContactsPdf(@Query() dto: ContactsExportDto, @Res() res: Response) {
    const buffer = await this.service.exportContactsPdf({ allPhones: dto.allPhones === "true", allEmails: dto.allEmails === "true" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="contatos.pdf"');
    res.send(buffer);
  }

  @Get("export/messages")
  @RequireModule("whatsapp")
  @RequirePermission("relatorios", "export")
  async exportMessages(@Query() dto: DateRangeDto, @Res() res: Response) {
    const csv = await this.service.exportMessagesCsv(dto);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="mensagens.csv"');
    res.send(csv);
  }

  @Get("export/messages.xlsx")
  @RequireModule("whatsapp")
  @RequirePermission("relatorios", "export")
  async exportMessagesXlsx(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportMessagesXlsx(dto);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="mensagens.xlsx"');
    res.send(buffer);
  }

  @Get("export/messages.pdf")
  @RequireModule("whatsapp")
  @RequirePermission("relatorios", "export")
  async exportMessagesPdf(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportMessagesPdf(dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="mensagens.pdf"');
    res.send(buffer);
  }

  @Get("export/conversations")
  @RequireModule("atendimento")
  @RequirePermission("relatorios", "export")
  async exportConversations(@Query() dto: DateRangeDto, @Res() res: Response) {
    const csv = await this.service.exportConversationsCsv(dto);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="conversas.csv"');
    res.send(csv);
  }

  @Get("export/conversations.xlsx")
  @RequireModule("atendimento")
  @RequirePermission("relatorios", "export")
  async exportConversationsXlsx(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportConversationsXlsx(dto);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="conversas.xlsx"');
    res.send(buffer);
  }

  @Get("export/conversations.pdf")
  @RequireModule("atendimento")
  @RequirePermission("relatorios", "export")
  async exportConversationsPdf(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportConversationsPdf(dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="conversas.pdf"');
    res.send(buffer);
  }

  @Get("export/chatbot-executions")
  @RequireModule("chatbot")
  @RequirePermission("relatorios", "export")
  async exportChatbotExecutions(@Query() dto: DateRangeDto, @Res() res: Response) {
    const csv = await this.service.exportChatbotExecutionsCsv(dto);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-chatbot.csv"');
    res.send(csv);
  }

  @Get("export/chatbot-executions.xlsx")
  @RequireModule("chatbot")
  @RequirePermission("relatorios", "export")
  async exportChatbotExecutionsXlsx(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportChatbotExecutionsXlsx(dto);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-chatbot.xlsx"');
    res.send(buffer);
  }

  @Get("export/chatbot-executions.pdf")
  @RequireModule("chatbot")
  @RequirePermission("relatorios", "export")
  async exportChatbotExecutionsPdf(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportChatbotExecutionsPdf(dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-chatbot.pdf"');
    res.send(buffer);
  }

  @Get("export/automation-executions")
  @RequireModule("automacao")
  @RequirePermission("relatorios", "export")
  async exportAutomationExecutions(@Query() dto: DateRangeDto, @Res() res: Response) {
    const csv = await this.service.exportAutomationExecutionsCsv(dto);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-automacao.csv"');
    res.send(csv);
  }

  @Get("export/automation-executions.xlsx")
  @RequireModule("automacao")
  @RequirePermission("relatorios", "export")
  async exportAutomationExecutionsXlsx(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportAutomationExecutionsXlsx(dto);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-automacao.xlsx"');
    res.send(buffer);
  }

  @Get("export/automation-executions.pdf")
  @RequireModule("automacao")
  @RequirePermission("relatorios", "export")
  async exportAutomationExecutionsPdf(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.service.exportAutomationExecutionsPdf(dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="execucoes-automacao.pdf"');
    res.send(buffer);
  }
}
