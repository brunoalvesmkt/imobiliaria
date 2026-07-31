# ARCHITECTURE.md

Arquitetura técnica da Plataforma SaaS Multiempresa de Atendimento, CRM, Chatbot, Automação e WhatsApp.

## 1. Visão geral

O sistema é um **monólito modular multi-tenant**. Não iniciamos com microserviços: um único backend (NestJS) hospeda todos os módulos de domínio, organizados em módulos internos com fronteiras claras, comunicando-se por contratos, eventos de domínio e filas — nunca por acesso direto e desorganizado a tabelas de outro módulo.

Cada empresa cliente é um **tenant**. Todo dado de negócio carrega `tenantId`. O tenant nunca é confiado a partir do input do cliente (body/query/header arbitrário) — é sempre resolvido a partir do contexto autenticado (JWT/sessão) ou do domínio/subdomínio validado da requisição.

Existem dois planos de acesso separados:
- **Painel da Empresa** (`tenant`): até 8 módulos comerciais ativáveis por plano.
- **Painel Master** (interno, equipe da plataforma): gestão de empresas, planos, financeiro, afiliados.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Frontend web | Next.js (App Router) + React + TypeScript + Tailwind CSS + React Hook Form + Zod + TanStack Query + Zustand (pontual) + React Flow (Flow Builder) |
| Backend API | Node.js + NestJS + TypeScript, REST + OpenAPI/Swagger, WebSocket (tempo real) |
| Worker | NestJS (processo separado) consumindo filas BullMQ |
| Banco de dados | PostgreSQL + Prisma ORM |
| Cache / filas | Redis + BullMQ |
| Armazenamento de arquivos | S3-compatible (MinIO em dev, S3/compatível em produção), URLs assinadas, bucket privado |
| Infraestrutura | Docker + Docker Compose, proxy reverso (Traefik), HTTPS, deploy em VPS própria |
| Observabilidade | Logs centralizados, métricas, health checks |

Justificativa: stack popular, ampla disponibilidade de programadores, forte tipagem ponta a ponta (TS estrito, sem `any` indiscriminado), maturidade de tooling.

## 3. Estrutura do monorepo

```
/apps
  /web        Next.js — painel da empresa + painel Master (rotas separadas)
  /api        NestJS — API HTTP + WebSocket (processo servidor principal)
  /worker     NestJS — processador de filas (BullMQ), sem endpoints HTTP públicos

/packages
  /ui               componentes de UI compartilhados (design system)
  /types            tipos TS compartilhados entre apps (DTOs, enums, contratos)
  /validation       schemas Zod compartilhados (validação client+server)
  /config           configuração compartilhada (env schema, constantes)
  /database         Prisma schema, client gerado, migrations, seeds
  /eslint-config     configuração de lint compartilhada
  /tsconfig          tsconfig base compartilhado
```

Gerenciado com **pnpm workspaces** + **Turborepo** (cache de build/test, pipelines `build`/`lint`/`typecheck`/`test` compartilhados entre apps).

Regra: `apps/*` pode depender de `packages/*`, mas `packages/*` nunca depende de `apps/*`. Módulos de domínio dentro de `apps/api` não importam diretamente arquivos internos de outro módulo — apenas seus serviços públicos exportados (`*.module.ts` + `index.ts` do módulo).

## 4. Módulos internos do backend (`apps/api/src/modules`)

Auth · Tenants · MasterUsers · TenantUsers · Permissions · Plans · Subscriptions · Billing · Companies · Contacts · CRM · Opportunities · Tasks · WhatsApp · Conversations · Atendimento · Chatbot · Automation · AI · KnowledgeBase · Reports · Affiliates · Domains · Files · Notifications · Audit · Webhooks · FeatureFlags.

### Comunicação entre módulos
1. **Contratos internos** — cada módulo expõe uma interface de serviço pública (`XxxPublicService`); consumidores dependem da interface, não da implementação.
2. **Eventos de domínio** — via `EventEmitter`/barramento interno (ex.: `conversation.started`, `chatbot.flow.completed`, `opportunity.stage.changed`). Módulos reagem a eventos sem acoplamento direto (ex.: CRM escuta `conversation.started` do módulo Conversations para criar/atualizar lead, só se o módulo CRM estiver ativo para o tenant).
3. **Filas (BullMQ)** — para trabalho assíncrono/desacoplado (envio de mensagens, automações, follow-ups, webhooks, relatórios, notificações, IA, importações, agendamentos, reconexões). Cada fila listada na seção 3.6 do prompt mestre é uma queue BullMQ isolada.
4. **Feature flags** — todo acesso a funcionalidade de um módulo comercial passa por um guard/check de "módulo ativo para este tenant" antes de executar. Ver `MODULE_DEPENDENCIES.md`.

## 5. Fluxo de dados de alto nível

**Requisição HTTP autenticada:**
`Request → JwtAuthGuard → TenantResolutionGuard (resolve tenantId do token/domínio) → PermissionsGuard (RBAC) → FeatureFlagGuard (módulo ativo?) → Controller → Service (regra de negócio, sempre filtrando por tenantId) → Prisma Repository → PostgreSQL`

**Webhook do WhatsApp (Meta ou conexão não oficial):**
`Provider → Endpoint de webhook (validação de assinatura + idempotência) → Fila "webhooks" → Worker processa → resolve tenant/número → cria/atualiza Conversation+Message → emite evento de domínio → módulos interessados reagem (CRM cria lead, Automação dispara gatilho) → WebSocket notifica painel em tempo real`

**Execução de automação/follow-up:**
`Gatilho (evento de domínio ou cron) → Fila "automations" → Worker avalia condições → executa ações → registra AutomationExecution → trata erro com retry/backoff/dead-letter`

## 6. Abstração de provedores (WhatsApp)

Módulo `WhatsApp` define uma interface `WhatsAppProvider` (métodos: enviar mensagem, receber webhook, status de conexão, templates). Duas implementações:
- `MetaOfficialProvider` (API oficial da Meta)
- `UnofficialProvider` (conexão via QR Code, adaptador desacoplado)

Nenhum outro módulo do sistema depende diretamente de qual provedor está ativo — apenas do contrato `WhatsAppProvider`. Isso permite trocar/adicionar provedores sem alterar CRM, Chatbot, Automação ou Atendimento.

## 7. Tempo real

WebSocket (namespace por tenant) para: nova mensagem, atualização de status de conversa, indicador de digitação, atualização de fila/atendimento, notificações. Toda conexão WebSocket é autenticada e escopada por `tenantId` — nunca broadcast cross-tenant.

## 8. Infraestrutura e ambientes

- **Docker Compose** orquestra: `api`, `worker`, `web`, `postgres`, `redis`, `minio` (S3-compatible), `traefik` (proxy reverso/HTTPS).
- Ambientes: `development`, `test`, `staging`, `production` — configuração via variáveis de ambiente (`.env` por ambiente, nunca commitado; `.env.example` documentado).
- Deploy em VPS própria: proxy reverso Traefik com certificados HTTPS automáticos (Let's Encrypt), roteamento por domínio/subdomínio de tenant.
- CI/CD (detalhado em documentação futura de deploy): lint → typecheck → testes → build → migrations verificadas → deploy staging → smoke tests → aprovação manual → produção. Sem migration destrutiva automática em produção.
- Escalabilidade horizontal: `api` e `worker` são stateless (estado em Postgres/Redis), permitindo múltiplas réplicas atrás do proxy reverso; filas BullMQ naturalmente distribuem trabalho entre múltiplos workers.

## 9. Decisões registradas

- ORM: **Prisma** (maior maturidade, melhor DX para o time, migrations declarativas).
- Infraestrutura alvo: **Docker Compose em VPS própria** (não cloud gerenciada) — documentação mantida o mais agnóstica de provedor possível dentro dessa premissa.
- Painel Master e Painel da Empresa compartilham o mesmo app Next.js (`apps/web`) sob namespaces de rota distintos e autenticação/sessão distintas, para reduzir duplicação de design system — reavaliar separação em app próprio se a complexidade justificar futuramente.
