import { z } from "zod";

/** Um telefone do contato — item 10.1 do documento de alterações. */
export const contactPhoneSchema = z.object({
  numero: z.string().trim().min(1, "Informe o número."),
  tipo: z.enum(["whatsapp", "residencial", "comercial"], { errorMap: () => ({ message: "Tipo de telefone inválido." }) }),
  principal: z.boolean().optional(),
});

/** Um e-mail do contato — mesmo padrão de contactPhoneSchema. */
export const contactEmailSchema = z.object({
  email: z.string().email("E-mail inválido."),
  principal: z.boolean().optional(),
});

/** Espelha `apps/api/src/crm/contacts/dto/create-contact.dto.ts`. */
export const createContactSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  sobrenome: z.string().trim().optional(),
  cpf: z.string().trim().optional(),
  cnpj: z.string().trim().optional(),
  razaoSocial: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  emails: z.array(contactEmailSchema).optional(),
  origem: z.string().trim().optional(),
  origemId: z.string().uuid().optional(),
  phones: z.array(contactPhoneSchema).optional(),
  campanha: z.string().trim().optional(),
  produto: z.string().trim().optional(),
  servico: z.string().trim().optional(),
  responsavelId: z.string().uuid().optional(),
  observacoes: z.string().trim().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

/** Espelha `apps/api/src/crm/opportunities/dto/create-opportunity.dto.ts` (Fase 45). */
export const createOpportunitySchema = z.object({
  contactId: z.string().uuid("Contato inválido."),
  funnelId: z.string().uuid("Funil inválido."),
  stageId: z.string().uuid("Etapa inválida."),
  valor: z.number().min(0, "O valor não pode ser negativo.").optional(),
  produto: z.string().trim().optional(),
  servico: z.string().trim().optional(),
  responsavelId: z.string().uuid().optional(),
  previsaoFechamento: z.string().optional(),
  origem: z.string().trim().optional(),
  campanha: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

/** Espelha `apps/api/src/crm/tasks/dto/create-task.dto.ts` (Fase 45). */
export const TASK_TIPOS = ["retorno", "ligacao", "reuniao", "proposta", "cobranca", "pos_venda", "avaliacao", "custom"] as const;

export const createCrmTaskSchema = z.object({
  contactId: z.string().uuid("Contato inválido."),
  opportunityId: z.string().uuid().optional(),
  tipo: z.enum(TASK_TIPOS, { errorMap: () => ({ message: "Tipo de tarefa inválido." }) }),
  titulo: z.string().trim().min(1, "Informe o título."),
  descricao: z.string().trim().optional(),
  dataHora: z.string().min(1, "Informe a data/horário."),
  responsavelId: z.string().uuid().optional(),
});

export type CreateCrmTaskInput = z.infer<typeof createCrmTaskSchema>;
