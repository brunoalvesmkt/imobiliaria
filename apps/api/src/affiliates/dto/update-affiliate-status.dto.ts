import { IsIn } from "class-validator";
import type { AffiliateStatus } from "@chatbot-saas/database";

const STATUSES: AffiliateStatus[] = ["pending", "approved", "rejected", "active", "inactive", "blocked"];

export class UpdateAffiliateStatusDto {
  @IsIn(STATUSES)
  status!: AffiliateStatus;
}
