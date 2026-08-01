import type { Prisma } from "@chatbot-saas/database";

/**
 * Todo novo tenant já nasce com um funil padrão pronto pra uso — sem isso,
 * a empresa cai no CRM > Funil sem nenhuma etapa e precisa criar tudo na
 * mão antes de conseguir cadastrar a primeira oportunidade.
 */
export const DEFAULT_FUNNEL_NAME = "Atendimento";
export const DEFAULT_FUNNEL_STAGES = ["Novo Lead", "Contato Feito", "Proposta Enviada", "Ganho", "Perdido"];

export async function createDefaultFunnel(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  const funnel = await tx.funnel.create({
    data: { tenantId, nome: DEFAULT_FUNNEL_NAME, ordem: 0 },
  });
  await tx.funnelStage.createMany({
    data: DEFAULT_FUNNEL_STAGES.map((nome, ordem) => ({ funnelId: funnel.id, nome, ordem })),
  });
}
