import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { EmailConfirmationCodeJobData, PasswordResetEmailJobData, TenantUserWelcomeJobData } from "@chatbot-saas/types";

@Injectable()
export class NotificationsProducer {
  constructor(@InjectQueue("notifications") private readonly queue: Queue) {}

  enqueueTenantUserWelcome(data: TenantUserWelcomeJobData): Promise<unknown> {
    return this.queue.add("tenant_user.welcome", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  enqueuePasswordResetEmail(data: PasswordResetEmailJobData): Promise<unknown> {
    return this.queue.add("tenant_user.password_reset", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  enqueueEmailConfirmationCode(data: EmailConfirmationCodeJobData): Promise<unknown> {
    return this.queue.add("tenant.email_confirmation_code", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
