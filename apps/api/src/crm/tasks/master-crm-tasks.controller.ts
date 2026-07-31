import { Controller, Post, UseGuards } from "@nestjs/common";
import { MasterAuthGuard } from "../../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../../common/master-roles/master-roles.decorator";
import { CrmTasksOverdueScheduler } from "./crm-tasks-overdue.scheduler";

/**
 * Endpoint manual para disparar a verificação de retornos atrasados sem
 * esperar o cron (24 execuções/dia) — mesmo padrão de
 * `MasterBillingController.runRenewalCheck`, útil para administração e testes.
 */
@Controller("master/crm-tasks")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin", "suporte")
export class MasterCrmTasksController {
  constructor(private readonly scheduler: CrmTasksOverdueScheduler) {}

  @Post("run-overdue-check")
  runOverdueCheck() {
    return this.scheduler.runOverdueCheck();
  }
}
