import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { signupExtras } from "./support/signup-extras";
import { PrismaService } from "../prisma/prisma.service";
import { BaileysLoaderService, type BaileysModule } from "../whatsapp/providers/baileys/baileys-esm.loader";

/**
 * Testes de integração da ponte real de WhatsApp não oficial (Fase 48,
 * @whiskeysockets/baileys). Não é viável abrir um socket de verdade contra o
 * WhatsApp num teste automatizado (exigiria um telefone real escaneando um
 * QR) — por isso `BaileysLoaderService` é substituído por um dublê que se
 * comporta como o módulo real (mesmo formato de `default()`/`ev.on()`/
 * eventos), permitindo exercitar `BaileysConnectionManagerService` de ponta
 * a ponta (QR → conexão aberta → mensagem recebida → pipeline de conversas)
 * sem rede. O que este teste NÃO cobre — e não pode cobrir num ambiente
 * automatizado — é o protocolo real do WhatsApp em si; essa parte é
 * responsabilidade da biblioteca, não deste código.
 */
describe("WhatsApp — ponte não oficial real via Baileys (Fase 48)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdmin: ReturnType<typeof request.agent>;
  let tenant: { agent: ReturnType<typeof request.agent>; tenantId: string; userId: string };
  let createdSockets: FakeSocket[];

  interface FakeSocket {
    ev: { on: (event: string, handler: (payload: unknown) => void) => void };
    emit: (event: string, payload: unknown) => void;
    sendMessage: jest.Mock;
    logout: jest.Mock;
    end: jest.Mock;
  }

  function createFakeBaileysModule(): { module: BaileysModule; sockets: FakeSocket[] } {
    const sockets: FakeSocket[] = [];

    function createFakeSocket(): FakeSocket {
      const listeners: Record<string, Array<(payload: unknown) => void>> = {};
      const sock: FakeSocket = {
        ev: {
          on: (event, handler) => {
            (listeners[event] ??= []).push(handler);
            // Simula o Baileys real gerando o primeiro QR pouco depois de abrir o socket.
            if (event === "connection.update") {
              setImmediate(() => handler({ qr: `fake-baileys-qr-${sockets.length}` }));
            }
          },
        },
        emit: (event, payload) => {
          for (const handler of listeners[event] ?? []) handler(payload);
        },
        sendMessage: jest.fn(async () => ({ key: { id: `wamid-fake-${randomUUID().slice(0, 8)}` } })),
        logout: jest.fn(async () => undefined),
        end: jest.fn(),
      };
      sockets.push(sock);
      return sock;
    }

    const module = {
      default: jest.fn(() => createFakeSocket()) as unknown as BaileysModule["default"],
      useMultiFileAuthState: jest.fn(async () => ({ state: {}, saveCreds: jest.fn(async () => undefined) })),
      fetchLatestBaileysVersion: jest.fn(async () => ({ version: [2, 3000, 0] as [number, number, number] })),
      DisconnectReason: { loggedOut: 401 },
    };

    return { module, sockets };
  }

  function randomCnpj(): string {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
    const calc = (nums: number[], weights: number[]) => {
      const sum = nums.reduce((acc, n, i) => acc + n * (weights[i] ?? 0), 0);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return [...base, d1, d2].join("");
  }

  async function loginMaster(email: string, senha: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/master/login").send({ email, senha });
    if (res.status !== 200) throw new Error(`Login master falhou: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  async function signupTenant(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const email = `${label}-${suffix}@whatsapp-baileys-test.local`;
    const senha = "SenhaDeTeste123";
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post("/auth/tenant/signup").send({
      razaoSocial: `Empresa ${label} ${suffix}`,
      cnpj: randomCnpj(),
      responsavel: `Responsavel ${label}`,
      email,
      confirmacaoEmail: email,
      senha,
      confirmacaoSenha: senha,
      ...(await signupExtras(app)),
    });
    if (res.status !== 201) throw new Error(`Signup falhou: ${res.status} ${JSON.stringify(res.body)}`);
    const me = await agent.get("/auth/tenant/me");
    return { agent, tenantId: me.body.tenantId as string, userId: me.body.id as string };
  }

  async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 5000, intervalMs = 100): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const result = await fn();
      if (result) return result;
      if (Date.now() > deadline) throw new Error("Timeout esperando condição.");
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /** Cria um número, força o provedor para `baileys_unofficial` (o .env deste ambiente usa `fake_unofficial` por padrão — ver .env, seção WhatsApp) e aceita o risco. */
  async function createBaileysNumber() {
    const create = await tenant.agent.post("/whatsapp/numbers").send({
      tipo: "atendente",
      modalidade: "unofficial",
      numero: `5511${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });
    expect(create.status).toBe(201);
    await prisma.whatsAppNumber.update({ where: { id: create.body.id }, data: { provider: "baileys_unofficial" } });
    await tenant.agent.post(`/whatsapp/numbers/${create.body.id}/accept-risk`).send({});
    return create.body.id as string;
  }

  beforeAll(async () => {
    const fake = createFakeBaileysModule();
    createdSockets = fake.sockets;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BaileysLoaderService)
      .useValue({ load: async () => fake.module })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const seedEmail = process.env.MASTER_SEED_EMAIL;
    const seedPassword = process.env.MASTER_SEED_PASSWORD;
    if (!seedEmail || !seedPassword) throw new Error("MASTER_SEED_EMAIL/MASTER_SEED_PASSWORD ausentes no .env.");
    superAdmin = await loginMaster(seedEmail, seedPassword);
    tenant = await signupTenant("wpp-baileys");
    await superAdmin.patch(`/master/tenants/${tenant.tenantId}/modules`).send({ module: "whatsapp", enabled: true });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it("gera um QR real (renderizado como imagem PNG, não texto cru) e conecta quando o socket sinaliza connection: open", async () => {
    const numberId = await createBaileysNumber();

    const connect = await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    expect(connect.status).toBe(201);
    expect(connect.body.status).toBe("authenticating");
    expect(connect.body.qrCode).toMatch(/^data:image\/png;base64,/); // não é mais a string crua do provedor

    const sock = createdSockets.at(-1);
    if (!sock) throw new Error("Nenhum socket Baileys fake foi criado.");
    sock.emit("connection.update", { connection: "open" });

    const detail = await waitFor(async () => {
      const res = await tenant.agent.get(`/whatsapp/numbers/${numberId}`);
      return res.body.status === "connected" ? res.body : null;
    });
    expect(detail.status).toBe("connected");
  });

  it("mensagem recebida pelo socket chega na conversa pelo mesmo pipeline do webhook da Meta", async () => {
    const numberId = await createBaileysNumber();
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    const sock = createdSockets.at(-1);
    if (!sock) throw new Error("Nenhum socket Baileys fake foi criado.");
    sock.emit("connection.update", { connection: "open" });
    await waitFor(async () => {
      const res = await tenant.agent.get(`/whatsapp/numbers/${numberId}`);
      return res.body.status === "connected" ? res.body : null;
    });

    sock.emit("messages.upsert", {
      type: "notify",
      messages: [
        {
          key: { fromMe: false, id: `wamid-in-${randomUUID().slice(0, 8)}`, remoteJid: "5511988887777@s.whatsapp.net" },
          messageTimestamp: Math.floor(Date.now() / 1000),
          message: { conversation: "Oi, vim pelo WhatsApp de verdade" },
        },
      ],
    });

    const conversation = await waitFor(() =>
      prisma.conversation.findFirst({ where: { whatsAppNumberId: numberId, contatoNumero: "5511988887777" } }),
    );
    const messages = await prisma.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.conteudo).toBe("Oi, vim pelo WhatsApp de verdade");
    expect(messages[0]?.direction).toBe("in");
  });

  it("envio de mensagem chama sock.sendMessage e falha com erro claro se ainda não estiver conectado", async () => {
    const numberId = await createBaileysNumber();
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    // Ainda "authenticating" — nenhum socket abriu de verdade.

    const incoming = await tenant.agent.post("/whatsapp/conversations/dev/simulate-incoming").send({
      whatsAppNumberId: numberId,
      fromNumero: "5511977776666",
      conteudo: "Oi",
    });
    const conversationId = incoming.body.conversationId as string;

    const blockedSend = await tenant.agent
      .post(`/whatsapp/conversations/${conversationId}/messages`)
      .send({ tipo: "text", texto: "Não deveria sair" });
    expect(blockedSend.status).toBe(500); // erro do provedor propagado, sem fingir sucesso

    const sock = createdSockets.at(-1);
    if (!sock) throw new Error("Nenhum socket Baileys fake foi criado.");
    sock.emit("connection.update", { connection: "open" });
    await waitFor(async () => {
      const res = await tenant.agent.get(`/whatsapp/numbers/${numberId}`);
      return res.body.status === "connected" ? res.body : null;
    });

    const allowedSend = await tenant.agent
      .post(`/whatsapp/conversations/${conversationId}/messages`)
      .send({ tipo: "text", texto: "Agora sim" });
    expect(allowedSend.status).toBe(201);
    expect(sock.sendMessage).toHaveBeenCalledWith("5511977776666@s.whatsapp.net", { text: "Agora sim" });
  });

  it("logout real (disconnect) chama sock.logout e limpa a sessão — reconectar depois exige um QR novo", async () => {
    const numberId = await createBaileysNumber();
    await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    const firstSock = createdSockets.at(-1);
    if (!firstSock) throw new Error("Nenhum socket Baileys fake foi criado.");
    firstSock.emit("connection.update", { connection: "open" });
    await waitFor(async () => {
      const res = await tenant.agent.get(`/whatsapp/numbers/${numberId}`);
      return res.body.status === "connected" ? res.body : null;
    });

    const disconnect = await tenant.agent.post(`/whatsapp/numbers/${numberId}/disconnect`);
    expect(disconnect.status).toBe(201);
    expect(firstSock.logout).toHaveBeenCalled();

    const detail = await tenant.agent.get(`/whatsapp/numbers/${numberId}`);
    expect(detail.body.status).toBe("disconnected");

    const reconnect = await tenant.agent.post(`/whatsapp/numbers/${numberId}/connect`);
    expect(reconnect.status).toBe(201);
    expect(reconnect.body.qrCode).toMatch(/^data:image\/png;base64,/); // exige escanear de novo, não reaproveita a sessão anterior
  });
});
