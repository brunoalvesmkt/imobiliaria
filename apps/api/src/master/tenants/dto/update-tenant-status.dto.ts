import { IsIn } from "class-validator";
import type { TenantStatus } from "@chatbot-saas/database";

const STATUSES: TenantStatus[] = ["trial", "active", "suspended", "blocked", "cancelled"];

export class UpdateTenantStatusDto {
  @IsIn(STATUSES)
  status!: TenantStatus;
}
