import { Injectable } from "@nestjs/common";

/**
 * `@whiskeysockets/baileys` é publicado só como ESM ("type": "module" no seu
 * package.json), mas este projeto compila para CommonJS (ver
 * packages/tsconfig/nestjs.json). O TypeScript reescreve `await import(...)`
 * para `require(...)` quando o módulo de saída é CommonJS — o que quebra em
 * runtime com `ERR_REQUIRE_ESM` para um pacote ESM puro. `new Function`
 * aqui impede essa reescrita, preservando o `import()` nativo do Node — é o
 * workaround reconhecido pelos próprios mantenedores do TypeScript para
 * este caso exato (microsoft/TypeScript#43329). Verificado manualmente
 * nesta sessão antes de construir o resto da integração sobre ele.
 */
const nativeDynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;

export interface BaileysModule {
  default: (config: Record<string, unknown>) => BaileysSocket;
  useMultiFileAuthState: (folder: string) => Promise<{ state: unknown; saveCreds: () => Promise<void> }>;
  fetchLatestBaileysVersion: () => Promise<{ version: [number, number, number] }>;
  DisconnectReason: Record<string, number>;
}

/**
 * Recorte mínimo da API do socket do Baileys que este provedor usa —
 * evita depender dos tipos internos da lib (que mudam entre versões) em
 * troca de um contrato pequeno e estável para o resto do código.
 */
export interface BaileysSocket {
  ev: {
    on(event: "connection.update", handler: (update: BaileysConnectionUpdate) => void): void;
    on(event: "creds.update", handler: () => void): void;
    on(event: "messages.upsert", handler: (payload: BaileysMessagesUpsert) => void): void;
  };
  sendMessage(jid: string, content: Record<string, unknown>): Promise<{ key?: { id?: string } } | undefined>;
  logout(): Promise<void>;
  end(error?: Error): void;
}

export interface BaileysConnectionUpdate {
  connection?: "close" | "connecting" | "open";
  qr?: string;
  lastDisconnect?: { error?: { output?: { statusCode?: number } } };
}

export interface BaileysMessagesUpsert {
  type: string;
  messages: Array<{
    key: { fromMe?: boolean; id?: string; remoteJid?: string };
    messageTimestamp?: number | Long;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
      imageMessage?: { caption?: string };
    };
  }>;
}

interface Long {
  toNumber(): number;
}

@Injectable()
export class BaileysLoaderService {
  private modulePromise: Promise<BaileysModule> | null = null;

  load(): Promise<BaileysModule> {
    if (!this.modulePromise) {
      this.modulePromise = nativeDynamicImport("@whiskeysockets/baileys") as Promise<BaileysModule>;
    }
    return this.modulePromise;
  }
}
