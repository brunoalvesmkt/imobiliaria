import { Controller, Get, Headers, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantContextStorage } from "../../common/tenant/tenant-context";
import { ProviderRegistryService } from "../providers/provider-registry.service";
import { ConversationsService } from "../conversations/conversations.service";

/**
 * Endpoint público (sem TenantAuthGuard) — é a Meta quem chama, não um
 * usuário autenticado. O tenant nunca é lido do payload: é resolvido pelo
 * `phone_number_id` que recebeu o evento, buscando o `WhatsAppNumber`
 * correspondente entre todos os tenants (ver ARCHITECTURE.md §6 e
 * SECURITY.md §2 — "o tenant é resolvido pelo identificador do
 * número/conta que recebeu o evento, nunca por campo livre do payload").
 */
@Controller("whatsapp/webhooks")
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly providers: ProviderRegistryService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get("meta")
  verify(@Query() query: Record<string, string>, @Res() res: Response): void {
    const verifyToken = this.config.get<string>("META_WEBHOOK_VERIFY_TOKEN");
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken) {
      res.status(200).send(query["hub.challenge"]);
      return;
    }
    res.status(403).send("Forbidden");
  }

  @Post("meta")
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
    const metaProvider = this.providers.resolve("meta");

    if (!metaProvider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException("Assinatura de webhook inválida.");
    }

    const parsed = metaProvider.parseWebhookPayload(req.body);

    for (const message of parsed.messages) {
      const number = await this.prisma.whatsAppNumber.findFirst({
        where: { externalAccountId: message.toIdentifier },
      });
      if (!number) {
        continue; // número não cadastrado em nenhum tenant desta plataforma — ignora
      }

      await tenantContextStorage.run(
        { tenantId: number.tenantId, actor: { actorId: "system:whatsapp-webhook", actorType: "tenant_user" } },
        () => this.conversations.handleIncoming(number.id, message),
      );
    }

    for (const status of parsed.statusUpdates) {
      // externalId é globalmente único — seguro atualizar sem tenantId explícito.
      await this.prisma.message.updateMany({
        where: { externalId: status.externalId },
        data: { statusEntrega: status.status },
      });
    }

    res.status(200).send("EVENT_RECEIVED");
  }
}
