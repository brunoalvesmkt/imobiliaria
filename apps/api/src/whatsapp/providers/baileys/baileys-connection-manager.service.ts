import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import { PrismaService } from "../../../prisma/prisma.service";
import { DomainEventsService } from "../../../common/events/domain-events.service";
import { BaileysLoaderService, type BaileysSocket } from "./baileys-esm.loader";
import type { ConnectResult, OutgoingMessageContent, ParsedIncomingMessage, ProviderNumberContext, SendMessageResult } from "../whatsapp-provider.interface";

/** Nome do evento interno usado para entregar mensagens recebidas via socket ao pipeline de conversas (ver BaileysIncomingListener). */
export const BAILEYS_INCOMING_EVENT = "whatsapp.baileys.incoming_message";

export interface BaileysIncomingEventPayload {
  numberId: string;
  tenantId: string;
  message: ParsedIncomingMessage;
}

interface SessionState {
  sock: BaileysSocket;
  status: string;
  qr: string | undefined;
  tenantId: string;
  /** true quando o usuário pediu disconnect/logout explicitamente — impede o auto-reconnect de religar a sessão. */
  manuallyStopped: boolean;
  waiters: Array<(result: ConnectResult) => void>;
}

function toConnectResult(status: string, qr: string | undefined): ConnectResult {
  return qr ? { status, qrCode: qr } : { status };
}

/**
 * Dono do ciclo de vida de todas as conexões Baileys ativas do processo —
 * um socket WebSocket persistente por número em modalidade "não oficial",
 * mantido vivo pela duração do processo do apps/api (mesmo padrão do
 * RealtimeGateway: estado em memória, singleton do módulo). Sessão
 * (credenciais do pareamento) persistida em disco via `useMultiFileAuthState`
 * — sobrevive a reinícios do processo, e `onApplicationBootstrap` religa
 * automaticamente todo número que estava conectado antes do restart.
 */
@Injectable()
export class BaileysConnectionManagerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BaileysConnectionManagerService.name);
  private readonly sessions = new Map<string, SessionState>();
  private readonly baileysLogger = pino({ level: "silent" });

  constructor(
    private readonly loader: BaileysLoaderService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Religa automaticamente, na subida do processo, as sessões Baileys que
   * estavam conectadas antes do restart — sem isso, o `Map` em memória
   * nasce vazio a cada `docker compose up -d --build` e o número continua
   * mostrando "Conectado" (valor persistido no banco) mas nenhuma mensagem
   * chega mais ao backend, porque o socket real nunca foi recriado. As
   * credenciais em disco (`useMultiFileAuthState`) permitem reconectar sem
   * pedir um novo QR Code.
   */
  async onApplicationBootstrap(): Promise<void> {
    const numbers = await this.prisma.whatsAppNumber.findMany({
      where: { provider: "baileys_unofficial", status: "connected", deletedAt: null },
      select: { id: true, tenantId: true, numero: true, externalAccountId: true },
    });

    for (const number of numbers) {
      this.startSession(number).catch((error) =>
        this.logger.error(`Falha ao religar sessão Baileys do número ${number.id} na subida do processo: ${(error as Error).message}`),
      );
    }
  }

  private sessionDir(numberId: string): string {
    const base = this.config.get<string>("WHATSAPP_SESSIONS_DIR") ?? ".baileys-sessions";
    return join(process.cwd(), base, numberId);
  }

  getStatus(numberId: string): string | undefined {
    return this.sessions.get(numberId)?.status;
  }

  /**
   * Inicia (ou reaproveita) a sessão do número. Resolve assim que o
   * primeiro QR for gerado ou a conexão abrir — o que vier primeiro —
   * dentro de um limite de tempo razoável, para o endpoint HTTP de
   * `connect()` não ficar pendurado esperando um evento assíncrono do
   * socket. Atualizações de status subsequentes (novo QR, conexão
   * confirmada) chegam por polling em `getLatestQr`, não por uma segunda
   * resposta HTTP.
   */
  async startSession(number: ProviderNumberContext): Promise<ConnectResult> {
    const existing = this.sessions.get(number.id);
    if (existing && (existing.status === "connected" || existing.status === "authenticating")) {
      return toConnectResult(existing.status, existing.qr);
    }

    const baileys = await this.loader.load();
    const { state, saveCreds } = await baileys.useMultiFileAuthState(this.sessionDir(number.id));
    const { version } = await baileys.fetchLatestBaileysVersion();

    const sock = baileys.default({
      auth: state,
      version,
      logger: this.baileysLogger,
      printQRInTerminal: false,
    });

    const session: SessionState = {
      sock,
      status: "authenticating",
      qr: undefined,
      tenantId: number.tenantId,
      manuallyStopped: false,
      waiters: [],
    };
    this.sessions.set(number.id, session);

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => this.handleConnectionUpdate(number, update));
    sock.ev.on("messages.upsert", (payload) => this.handleMessagesUpsert(number, payload));

    return new Promise<ConnectResult>((resolve) => {
      session.waiters.push(resolve);
      // Nunca deixa o chamador HTTP esperando indefinidamente por um evento de rede de terceiro.
      setTimeout(() => this.resolveWaiters(number.id, toConnectResult(session.status, session.qr)), 15_000);
    });
  }

  private resolveWaiters(numberId: string, result: ConnectResult): void {
    const session = this.sessions.get(numberId);
    if (!session || session.waiters.length === 0) return;
    const waiters = session.waiters.splice(0, session.waiters.length);
    for (const waiter of waiters) waiter(result);
  }

  private async handleConnectionUpdate(
    number: ProviderNumberContext,
    update: { connection?: string; qr?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } } },
  ): Promise<void> {
    const session = this.sessions.get(number.id);
    if (!session) return;

    if (update.qr) {
      session.qr = update.qr;
      session.status = "authenticating";
      await this.persistStatus(number.id, "authenticating");
      this.resolveWaiters(number.id, toConnectResult("authenticating", update.qr));
    }

    if (update.connection === "open") {
      session.status = "connected";
      session.qr = undefined;
      await this.persistStatus(number.id, "connected");
      this.domainEvents.emit("whatsapp_number.connected", {
        tenantId: number.tenantId,
        data: { whatsAppNumberId: number.id, numero: number.numero },
      });
      this.resolveWaiters(number.id, { status: "connected" });
    }

    if (update.connection === "close") {
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === 401; // DisconnectReason.loggedOut — comparado por valor para não depender do carregamento ESM aqui.
      this.sessions.delete(number.id);

      if (loggedOut || session.manuallyStopped) {
        await this.persistStatus(number.id, "disconnected");
        if (loggedOut) {
          await rm(this.sessionDir(number.id), { recursive: true, force: true }).catch(() => undefined);
          this.domainEvents.emit("whatsapp_number.disconnected", {
            tenantId: number.tenantId,
            data: { whatsAppNumberId: number.id, numero: number.numero },
          });
        }
        this.resolveWaiters(number.id, { status: "disconnected" });
        return;
      }

      // Queda de rede / reinício do lado do WhatsApp — tenta reconectar sozinho, sem exigir novo QR
      // (a sessão em disco continua válida; só um restart frio do processo perde o estado em memória).
      this.logger.warn(`Conexão Baileys do número ${number.id} caiu, tentando reconectar...`);
      this.startSession(number).catch((error) =>
        this.logger.error(`Falha ao reconectar número ${number.id}: ${(error as Error).message}`),
      );
    }
  }

  private handleMessagesUpsert(
    number: ProviderNumberContext,
    payload: {
      type: string;
      messages: Array<{
        key: { fromMe?: boolean; id?: string; remoteJid?: string; senderPn?: string };
        messageTimestamp?: number | { toNumber(): number };
        message?: { conversation?: string; extendedTextMessage?: { text?: string } };
      }>;
    },
  ): void {
    if (payload.type !== "notify") return;

    for (const msg of payload.messages) {
      if (msg.key.fromMe || !msg.key.remoteJid || !msg.key.id) continue;

      const texto = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text;
      if (texto === undefined) continue; // mídia (imagem/áudio/documento) sem legenda/transcrição fica para uma próxima fase, não finge processar.

      // Contatos com a proteção "ocultar número" do WhatsApp chegam com `remoteJid` no formato LID
      // (ex.: "108379724877916@lid"), um identificador interno sem relação com o telefone real —
      // vira um número "estranho" na tela. `key.senderPn` traz o JID com o número de telefone de
      // verdade nesse caso; cai para `remoteJid` normalmente (contatos sem essa proteção).
      const jid = msg.key.senderPn ?? msg.key.remoteJid;
      const timestamp = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : msg.messageTimestamp?.toNumber();
      const parsed: ParsedIncomingMessage = {
        externalId: msg.key.id,
        fromNumero: jid.split("@")[0] ?? jid,
        toIdentifier: number.id,
        tipo: "text",
        conteudo: texto,
        timestamp: timestamp ? new Date(timestamp * 1000) : new Date(),
      };

      this.events.emit(BAILEYS_INCOMING_EVENT, {
        numberId: number.id,
        tenantId: number.tenantId,
        message: parsed,
      } satisfies BaileysIncomingEventPayload);
    }
  }

  private async persistStatus(numberId: string, status: string): Promise<void> {
    await this.prisma.whatsAppNumber.update({ where: { id: numberId }, data: { status } }).catch(() => undefined);
  }

  async getLatestQr(number: ProviderNumberContext): Promise<ConnectResult> {
    const session = this.sessions.get(number.id);
    if (session) {
      return toConnectResult(session.status, session.qr);
    }
    const record = await this.prisma.whatsAppNumber.findUnique({ where: { id: number.id }, select: { status: true } });
    return { status: record?.status ?? "disconnected" };
  }

  async logout(number: ProviderNumberContext): Promise<void> {
    const session = this.sessions.get(number.id);
    if (!session) {
      await rm(this.sessionDir(number.id), { recursive: true, force: true }).catch(() => undefined);
      return;
    }
    session.manuallyStopped = true;
    try {
      await session.sock.logout();
    } catch (error) {
      this.logger.warn(`Logout Baileys do número ${number.id} falhou (sessão já pode estar morta): ${(error as Error).message}`);
      session.sock.end(undefined);
    }
    this.sessions.delete(number.id);
    await rm(this.sessionDir(number.id), { recursive: true, force: true }).catch(() => undefined);
  }

  /**
   * "Digitando..."/"Gravando áudio..." de verdade no WhatsApp do contato — usado pelo motor do
   * chatbot para simular uma pausa natural antes de responder (ver ChatbotEngineService). Melhor
   * esforço deliberado: nunca lança erro nem impede o envio da mensagem real logo em seguida —
   * uma falha aqui é só cosmética (o card ainda manda a mensagem, só sem o indicador).
   */
  async sendPresenceUpdate(number: ProviderNumberContext, to: string, state: "composing" | "paused"): Promise<void> {
    const session = this.sessions.get(number.id);
    if (!session || session.status !== "connected") return;
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    try {
      await session.sock.sendPresenceUpdate(state, jid);
    } catch (error) {
      this.logger.warn(`Falha ao enviar indicador de "digitando" para o número ${number.id}: ${(error as Error).message}`);
    }
  }

  async sendMessage(number: ProviderNumberContext, to: string, content: OutgoingMessageContent): Promise<SendMessageResult> {
    const session = this.sessions.get(number.id);
    if (!session || session.status !== "connected") {
      throw new Error("Número não está conectado — escaneie o QR Code antes de enviar mensagens.");
    }

    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    const messageContent =
      content.tipo === "text"
        ? { text: content.texto ?? "" }
        : { [content.tipo]: { url: content.midiaUrl }, caption: content.texto };

    const result = await session.sock.sendMessage(jid, messageContent);
    if (!result?.key?.id) {
      throw new Error("Falha ao enviar mensagem via Baileys — socket não retornou id.");
    }
    return { externalId: result.key.id };
  }
}
