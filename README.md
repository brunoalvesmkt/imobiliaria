# Chatbot SaaS Platform

Plataforma SaaS multiempresa de Atendimento, CRM, Chatbot, Automação e WhatsApp.

Este repositório está na etapa de **fundação**: os documentos abaixo definem arquitetura, banco, segurança, permissões e o roadmap antes de qualquer implementação de funcionalidade. Leia-os nesta ordem antes de contribuir:

1. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura técnica, stack, estrutura do monorepo.
2. [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md) — modelagem conceitual das entidades.
3. [`MODULE_DEPENDENCIES.md`](./MODULE_DEPENDENCIES.md) — ativação/desativação e integrações condicionais entre módulos.
4. [`PERMISSIONS_MATRIX.md`](./PERMISSIONS_MATRIX.md) — matriz RBAC.
5. [`SECURITY.md`](./SECURITY.md) — checklist de segurança e isolamento multi-tenant.
6. [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md) — critérios de aceite e casos de teste críticos.
7. [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) — roadmap de 10 fases e plano detalhado da Fase 1.

## Estrutura do monorepo

```
/apps
  /web        Next.js — painel da empresa + painel Master
  /api        NestJS — API HTTP + WebSocket
  /worker     NestJS — processador de filas (BullMQ)

/packages
  /ui               componentes de UI compartilhados
  /types            tipos TS compartilhados
  /validation       schemas Zod compartilhados
  /config           configuração compartilhada
  /database         Prisma schema, client, migrations, seeds
  /eslint-config    configuração de lint compartilhada
  /tsconfig         tsconfig base compartilhado
```

## Como rodar (desenvolvimento)

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis minio
pnpm --filter @chatbot-saas/database migrate
pnpm --filter @chatbot-saas/database seed
pnpm dev
```

`pnpm dev` sobe `web` (Next.js, :3000), `api` (NestJS, :3001) e `worker` (NestJS, consumidor de filas). A API expõe Swagger/rotas de autenticação (`/auth/tenant/*`, `/auth/master/*`), CRUD de usuários (`/tenant-users`), papéis (`/roles`), arquivos (`/files`) e dados do tenant (`/tenants/me`).

Rodar os testes automatizados (isolamento multi-tenant, autorização, hashing):

```bash
pnpm --filter @chatbot-saas/api test
```

## Status

**Backend: roadmap de 10 fases concluído** (`apps/api` + `apps/worker`, 70 testes automatizados, typecheck limpo). **Frontend (`apps/web`): Fases F1–F9 concluídas** (Fundação, CRM, WhatsApp e Atendimento, Chatbot, Automação, Financeiro, Relatórios, Polimento, Painel Master/Afiliados) — autenticação real, shell do painel adaptável aos módulos ativos do tenant, dashboard "Início", tema claro/escuro e 4 idiomas (pt-BR, pt-PT, en, es) em toda a interface, CRM completo, WhatsApp/Atendimento em tempo real, Flow Builder do Chatbot, construtor de Automação, Financeiro, 6 relatórios com exportação CSV, responsividade real (menu lateral em gaveta no mobile, Caixa de entrada empilhável, tabelas e formulários que se adaptam), acessibilidade (rótulos em botões-ícone, `lang` do documento sincronizado com o idioma escolhido), e um Painel Master completo (autenticação e shell próprios, namespace de cookie separado do tenant) com gestão de Empresas (status/plano/módulos), Planos, Afiliados (comissões, indicações, pagamento em lote) e Usuários Master. Com a Fase F9, o roadmap de frontend combinado com o usuário foi integralmente concluído.

**Novo ciclo — Fase 11 (backend + frontend): Integração com IA concluída.** A plataforma agora conecta de verdade com Claude (Anthropic), ChatGPT (OpenAI) e Gemini (Google) — modelo híbrido de chave: cada empresa pode usar a própria chave de API (BYOK, cadastrada em Configurações, criptografada em repouso com AES-256-GCM) e/ou a chave compartilhada da plataforma, liberado individualmente por empresa pelo Painel Master. Primeiro caso de uso: os cards "IA" e "Consulta à Base" do Flow Builder do Chatbot, que agora executam de verdade contra os três provedores em vez de serem rejeitados na publicação. 79/79 testes do backend passando (12 novos de IA), typecheck limpo, verificado em navegador de ponta a ponta. Ver `DEVELOPMENT_PLAN.md` para o histórico completo de todas as fases e os débitos técnicos conscientes registrados.
