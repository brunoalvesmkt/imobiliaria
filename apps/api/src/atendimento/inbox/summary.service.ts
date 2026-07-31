import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ConversationSummary {
  texto: string;
  nome: string | null;
  telefone: string;
  origem: string | null;
  ultimasMensagens: Array<{ direction: string; conteudo: string | null; createdAt: string }>;
}

/**
 * Gera o resumo estruturado exigido ao transferir uma conversa sem API
 * oficial (seção 9.7 do prompt mestre: "Sem API oficial, gerar e enviar
 * resumo ao próximo atendente"). Sem IA configurada nesta fase, o resumo é
 * determinístico — nome, telefone, origem e últimas mensagens — em vez de
 * um resumo em linguagem natural gerado por modelo (isso é um upgrade
 * natural do módulo de IA em fase futura, mesma estrutura de dados).
 */
@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(conversationId: string): Promise<ConversationSummary> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    const ultimasMensagens = conversation.messages
      .slice()
      .reverse()
      .map((m) => ({ direction: m.direction, conteudo: m.conteudo, createdAt: m.createdAt.toISOString() }));

    const nome = conversation.contact?.nome ?? null;
    const linhas = [
      `Contato: ${nome ?? "(sem cadastro no CRM)"}`,
      `Telefone: ${conversation.contatoNumero}`,
      `Origem: ${conversation.origem ?? "não informada"}`,
      conversation.contact?.observacoes ? `Observações: ${conversation.contact.observacoes}` : undefined,
      "Últimas mensagens:",
      ...ultimasMensagens.map((m) => `  [${m.direction === "in" ? "cliente" : "atendimento"}] ${m.conteudo ?? "(mídia)"}`),
    ].filter((line): line is string => line !== undefined);

    return {
      texto: linhas.join("\n"),
      nome,
      telefone: conversation.contatoNumero,
      origem: conversation.origem,
      ultimasMensagens,
    };
  }
}
