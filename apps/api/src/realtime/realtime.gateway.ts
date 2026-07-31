import { Injectable, Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { TokenService } from "../auth/token.service";
import { TENANT_ACCESS_COOKIE } from "../auth/cookie.util";
import { PrismaService } from "../prisma/prisma.service";

interface ViewerInfo {
  socketId: string;
  userId: string;
  userName: string;
}

function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

function extractTokenFromSocket(client: Socket): string | undefined {
  const fromAuth = client.handshake.auth?.["token"] as string | undefined;
  if (fromAuth) {
    return fromAuth;
  }

  const cookieHeader = client.handshake.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TENANT_ACCESS_COOKIE}=`));
  return match?.slice(TENANT_ACCESS_COOKIE.length + 1);
}

/**
 * Tempo real do Atendimento — namespace único, isolado por sala
 * (`tenant:<tenantId>`) para nunca vazar evento entre tenants (ver
 * SECURITY.md §2). Autenticação aceita o token tanto via
 * `socket.handshake.auth.token` (clientes que não podem ler cookie
 * HttpOnly) quanto via cookie de sessão normal (navegador).
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: process.env.APP_URL ?? "http://localhost:3000", credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  /**
   * Presença por conversa (Fase 54, "controle de concorrência entre
   * atendentes") — só em memória, propositalmente: some sozinha se o
   * processo reiniciar ou o socket cair, sem exigir nenhuma limpeza
   * assíncrona. Não é a fonte de verdade de quem é responsável pela
   * conversa (isso é `Conversation.responsavelId`, no banco) — é só "quem
   * está com a tela aberta agora", para avisar antes de uma ação colidir.
   */
  private readonly viewers = new Map<string, Map<string, ViewerInfo>>();

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = extractTokenFromSocket(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.tokenService.verifyAccessToken(token);
      if (payload.type !== "tenant") {
        client.disconnect(true);
        return;
      }

      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub;
      const user = await this.prisma.tenantUser.findUnique({ where: { id: payload.sub }, select: { nome: true } });
      client.data.userName = user?.nome ?? "Agente";
      void client.join(tenantRoom(payload.tenantId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket desconectado: ${client.id}`);
    for (const [conversationId, viewers] of this.viewers) {
      if (viewers.delete(client.id)) {
        this.broadcastViewers(client.data.tenantId as string, conversationId);
      }
    }
  }

  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    this.server?.to(tenantRoom(tenantId)).emit(event, payload);
  }

  private broadcastViewers(tenantId: string, conversationId: string): void {
    const viewers = Array.from(this.viewers.get(conversationId)?.values() ?? []);
    this.emitToTenant(tenantId, "conversation:viewers", { conversationId, viewers });
  }

  @SubscribeMessage("conversation:view")
  onView(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }): void {
    const tenantId = client.data.tenantId as string | undefined;
    if (!tenantId || !body?.conversationId) return;

    let viewers = this.viewers.get(body.conversationId);
    if (!viewers) {
      viewers = new Map();
      this.viewers.set(body.conversationId, viewers);
    }
    viewers.set(client.id, {
      socketId: client.id,
      userId: client.data.userId as string,
      userName: client.data.userName as string,
    });
    this.broadcastViewers(tenantId, body.conversationId);
  }

  @SubscribeMessage("conversation:unview")
  onUnview(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string }): void {
    const tenantId = client.data.tenantId as string | undefined;
    if (!tenantId || !body?.conversationId) return;

    if (this.viewers.get(body.conversationId)?.delete(client.id)) {
      this.broadcastViewers(tenantId, body.conversationId);
    }
  }

  /** Indicador de digitação (Fase 55) — efêmero, nunca persistido; só repassado aos outros sockets do mesmo tenant. */
  @SubscribeMessage("conversation:typing")
  onTyping(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId: string; isTyping: boolean }): void {
    const tenantId = client.data.tenantId as string | undefined;
    if (!tenantId || !body?.conversationId) return;

    client.to(tenantRoom(tenantId)).emit("conversation:typing", {
      conversationId: body.conversationId,
      userId: client.data.userId as string,
      userName: client.data.userName as string,
      isTyping: body.isTyping,
    });
  }
}
