# DATABASE_DESIGN.md

Modelagem conceitual das entidades principais. Este documento é o ERD conceitual que guiará o `schema.prisma` real, a ser escrito na Fase 1 de implementação — não é o schema Prisma final.

## Convenções globais

- Toda entidade tem `id` (UUID), `createdAt`, `updatedAt`.
- Toda entidade de negócio pertencente a uma empresa tem `tenantId` (FK obrigatória para `Tenant`, indexado). Exceções explícitas: `Tenant`, `MasterUser`, `Plan`, `Affiliate`, `AffiliateCommission` (ligadas a tenant só indiretamente).
- Soft delete via `deletedAt` (nullable) nas entidades onde exclusão precisa preservar histórico (Contact, Opportunity, ChatbotFlow, Automation, WhatsAppNumber, Conversation). Exclusão física evitada; ver `SECURITY.md`/seção 30 do prompt mestre ("não apagar dados").
- Toda tabela multiempresa tem índice composto começando por `tenantId` nas colunas mais consultadas (ex.: `(tenantId, status)`, `(tenantId, phone)`).
- Row-Level Security (RLS) do Postgres avaliado como camada extra de defesa nas tabelas mais sensíveis (Contact, Conversation, Message, Opportunity) — reforço além do filtro `tenantId` na aplicação, não substituto.

## 1. Identidade e organização

**Tenant** — id, razaoSocial, cnpj, responsavel, endereco, telefone, whatsapp, email, logoUrl, subdominio, dominioCustom, status (trial/active/suspended/cancelled), planId, createdAt.

**MasterUser** — id, nome, email, passwordHash, role (super_admin/financeiro/suporte), status, lastLoginAt. Sem tenantId — usuário da equipe da plataforma.

**TenantUser** — id, tenantId, nome, email, passwordHash, roleId, status (active/inactive), lastLoginAt, invitedBy, invitedAt.

**Role** — id, tenantId (null = papel padrão do sistema, não editável), nome, descricao.

**Permission** — id, roleId, module, action, scope (opcional: queueId/teamId/departmentId/campaignId/flowId/portfolioId/unitId). Ver `PERMISSIONS_MATRIX.md`.

**AuditLog** — id, tenantId (nullable p/ ações Master), actorId, actorType (master/tenant_user), action, entity, entityId, previousData (JSON), newData (JSON), ip, userAgent, timestamp.

**FeatureFlag** — id, tenantId, module (crm/whatsapp/chatbot/automation/reports/...), enabled, enabledAt, disabledAt, config (JSON, limites específicos do módulo).

## 2. Planos, assinaturas e financeiro

**Plan** — id, nome, descricao, preco, recorrencia, modulosIncluidos (JSON/relação), limites (JSON: usuários, números, automações, armazenamento, histórico), iaIncluida, apiOficialIncluida.

**Subscription** — id, tenantId, planId, status (waiting/active/overdue/delinquent/suspended/cancelled/refunded), startedAt, renewedAt, cancelledAt.

**Invoice** — id, tenantId, subscriptionId, valor, status, vencimento, pagoEm, metodo (pix/boleto/cartao/manual), gatewayRef.

## 3. Contatos e CRM

**Contact** — id, tenantId, nome, sobrenome, cpf, rg, cnpj, razaoSocial, nascimento, telefone, whatsapp, email, endereco (cep/logradouro/numero/complemento/bairro/cidade/estado/pais), origem, campanha, conjunto, anuncio, produto, servico, responsavelId, observacoes, customFields (JSON), deletedAt.

**ContactTag** — id, tenantId, contactId, tag.

**Funnel** — id, tenantId, nome, descricao, status, ordem.

**FunnelStage** — id, funnelId, nome, ordem, cor, probabilidade, camposObrigatorios (JSON), slaHoras, ativo.

**Opportunity** — id, tenantId, contactId, funnelId, stageId, valor, probabilidade, produto, servico, responsavelId, previsaoFechamento, origem, campanha, motivoGanho, motivoPerda, observacoes, status (open/won/lost), deletedAt.

**Task** (CRM) — id, tenantId, contactId, opportunityId (nullable), tipo (retorno/ligacao/reuniao/proposta/cobranca/pos_venda/avaliacao/custom), titulo, descricao, dataHora, responsavelId, status (pending/done/overdue), concluidaEm.

**DeduplicationRule** — id, tenantId, campo (whatsapp/telefone/email/cpf/cnpj), ativo, prioridade.

## 4. WhatsApp e conversas

**WhatsAppNumber** — id, tenantId, tipo (chatbot/atendente), modalidade (official_api/unofficial), numero, status (connected/disconnected/paused/authenticating/unavailable/error/blocked), provider, credenciais (referência a secret, nunca em texto puro), teamId/queueId/userId (quando atendente), deletedAt.

**WhatsAppTemplate** — id, tenantId, whatsAppAccountId, nome, idioma, categoria, cabecalho, corpo, rodape, variaveis (JSON), botoes (JSON), status (draft/pending/approved/rejected), versao.

**RiskAcceptance** — id, tenantId, userId, whatsAppNumberId, aceitoEm, versaoTermo, ip, recursosAtivados (JSON). Registro do aceite de risco da conexão não oficial (seção 13.8 do prompt mestre).

**Conversation** — id, tenantId, contactId, whatsAppNumberId, queueId, responsavelId, origem, prioridade, status (open/pending/closed), unreadCount, lastMessageAt, deletedAt.

**Message** — id, tenantId, conversationId, direction (in/out), senderType (contact/agent/chatbot/system), tipo (text/image/audio/video/document/location), conteudo, midiaUrl, statusEntrega (sent/delivered/read/failed), externalId (idempotência com o provedor), createdAt.

**ConversationEvent** — id, tenantId, conversationId, tipo (transfer/assign/reopen/close/summary), payload (JSON), actorId, createdAt.

## 5. Atendimento

**Queue** — id, tenantId, nome, descricao, teamId, prioridade, distribuicao (round_robin/next/least_volume/availability/priority), slaMinutos, mensagemEspera, mensagemForaExpediente.

**Team** — id, tenantId, nome.

**TeamMember** — id, teamId, tenantUserId, papel (agent/supervisor).

**BusinessHours** — id, tenantId, escopo (number/team/queue/department), escopoId, diaSemana, horaInicio, horaFim, feriadoData (nullable, para datas especiais).

## 6. Chatbot

**ChatbotFlow** — id, tenantId, nome, descricao, status (draft/published/paused/archived), versaoAtual, aiEnabled, deletedAt.

**ChatbotFlowVersion** — id, chatbotFlowId, versao, definicao (JSON: nodes + edges do Flow Builder), publicadaEm.

**ChatbotFlowNode** — modelado dentro de `definicao` (JSON) da versão, não como tabela relacional própria — nós: start/message/question/answer/menu/condition/decision/wait/capture/validation/ai/knowledge_query/transfer/media/document/location/return/subflow/end. Cada node referencia `subflowId` quando aplicável.

**ChatbotExecution** — id, tenantId, chatbotFlowId, versao, conversationId, contactId, status (running/completed/abandoned/transferred), currentNodeId, contextData (JSON), startedAt, finishedAt.

**KnowledgeBaseItem** — id, tenantId, tipo (empresa/produto/servico/preco/politica/horario/entrega/garantia/pagamento/faq/documento/texto), titulo, conteudo, arquivoId (nullable), campanha (nullable, contexto por campanha), ativo.

## 7. Automação

**Automation** — id, tenantId, nome, descricao, gatilho (JSON: tipo + parâmetros), condicoes (JSON), acoes (JSON), status (active/paused/archived), versao.

**AutomationExecution** — id, tenantId, automationId, contactId, conversationId (nullable), gatilhoDisparado, acoesExecutadas (JSON), tentativas, status (pending/running/success/failed/dead_letter), erro (nullable), executedAt.

**FollowUpSchedule** — id, tenantId, automationId, contactId, sequenciaIndex, agendadoPara, status (scheduled/sent/cancelled), canceladoPorEvento (nullable).

## 8. Mensagens reutilizáveis

**MessageTemplate** (biblioteca única, distinta de `WhatsAppTemplate`/Meta) — id, tenantId, nome, descricao, categoria (atendimento/chatbot/follow_up/orcamento/cobranca/confirmacao/lembrete/pos_venda/avaliacao/campanha/manual), conteudo, variaveis (JSON), anexos (JSON), usoManual, usoAutomatico, canais (JSON), numerosAutorizados (JSON), status.

## 9. Arquivos

**File** — id, tenantId, bucketKey, nomeOriginal, mimeType, tamanho, escopo (contact/conversation/knowledge_base/affiliate/receipt/other), escopoId, uploadedBy, privado (bool), deletedAt.

## 10. Notificações e webhooks

**Notification** — id, tenantId, tenantUserId (nullable = broadcast tenant), tipo, titulo, mensagem, lida, lidaEm, payload (JSON).

**WebhookEndpoint** — id, tenantId, url, eventos (JSON, lista de eventos assinados), secret (referência a secret), ativo.

**WebhookDelivery** — id, tenantId, webhookEndpointId, evento, payload (JSON), tentativas, status (pending/success/failed), idempotencyKey (unique).

## 11. Afiliados

**Affiliate** — id, nome, sobrenome, rg, cpf, nascimento, email, telefone, whatsapp, endereco, dadosPagamento (referência segura), status (pending/approved/rejected/active/inactive/blocked), linkCode (unique), aceitoTermosEm.

**AffiliateCommission** — id, affiliateId, tipo (percentual/fixo), valor, recorrente, planId (nullable), moduleId (nullable), prazoLimiteDias (nullable), carenciaDias, minimoParaPagamento.

**AffiliateReferral** — id, affiliateId, tenantId (nullable até conversão), evento (click/signup/subscription/renewal/cancellation/refund), planId (nullable), valorComissao (nullable), status (pending/paid/reversed), createdAt.

## 12. Domínios

**Domain** — id, tenantId, tipo (subdomain/custom), valor, status (pending/validating/active/failed), sslStatus, dnsInstrucoes (JSON).

## 13. Relacionamento entre módulos comerciais e entidades

- CRM: Contact, Funnel, FunnelStage, Opportunity, Task, DeduplicationRule.
- WhatsApp: WhatsAppNumber, WhatsAppTemplate, RiskAcceptance.
- Atendimento: Conversation, Message, ConversationEvent, Queue, Team, TeamMember, BusinessHours (consome Contact e WhatsAppNumber).
- Chatbot: ChatbotFlow, ChatbotFlowVersion, ChatbotExecution, KnowledgeBaseItem (consome Conversation, opcionalmente cria/atualiza Contact via evento).
- Automação: Automation, AutomationExecution, FollowUpSchedule (consome eventos de todos os módulos ativos).
- Relatórios: apenas leitura agregada das entidades acima, sem tabelas próprias além de views/materialized views futuras.

## 14. Índices e integridade recomendados (destaques)

- `Contact`: unique composto `(tenantId, whatsapp)` quando preenchido; index `(tenantId, email)`, `(tenantId, cpf)`, `(tenantId, cnpj)` para deduplicação.
- `Conversation`: index `(tenantId, status, lastMessageAt)`.
- `Message`: unique `(tenantId, externalId)` para idempotência de webhook.
- `WebhookDelivery`: unique `(tenantId, idempotencyKey)`.
- `AutomationExecution`: index `(tenantId, automationId, contactId, status)` para evitar disparo duplicado.
- FKs com `ON DELETE RESTRICT` como padrão para entidades de negócio (evita exclusão em cascata acidental); `ON DELETE CASCADE` apenas em entidades filhas estritamente dependentes (ex.: `ChatbotFlowVersion` de `ChatbotFlow`).
