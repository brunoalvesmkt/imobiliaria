# SECURITY.md

Checklist de segurança obrigatória e estratégia de isolamento multi-tenant. Nenhuma feature é considerada "pronta" sem atender aos itens aplicáveis deste documento (ver `ACCEPTANCE_CRITERIA.md`).

## 1. Autenticação e credenciais

- Hash de senha: **Argon2id** (nunca bcrypt/md5/sha simples).
- Tokens: JWT de acesso de curta duração + refresh token com **rotação** a cada uso (refresh token antigo invalidado ao gerar um novo).
- Cookies de sessão/refresh: `HttpOnly`, `Secure`, `SameSite=Strict` (ou `Lax` quando necessário para fluxo OAuth futuro).
- Proteção CSRF nas rotas que aceitam cookie de sessão.
- Rate limiting em login, recuperação de senha e endpoints públicos sensíveis (webhooks incluídos, por IP/origem).
- Bloqueio progressivo após tentativas de login inválidas (backoff crescente, nunca bloqueio permanente silencioso sem trilha de auditoria).
- Recuperação de senha: token de uso único, expiração curta, revogação ao ser usado, **resposta neutra** (não revela se o e-mail existe — evita user enumeration).
- Cadastro de e-mail em formulários críticos (ex.: cadastro de empresa): campo de confirmação de e-mail sem colar (paste bloqueado no client, mas validação de igualdade sempre também no backend).
- Nunca armazenar credenciais sensíveis (senhas, tokens de provedor WhatsApp, segredos de API) em texto puro — sempre hash (senha) ou criptografado/cofre de segredos (tokens/API keys).

## 2. Isolamento multi-tenant (crítico)

Regra central: **o `tenantId` nunca é confiado a partir de input do cliente.** Ele é sempre derivado de:
- claim no JWT autenticado, ou
- domínio/subdomínio validado da requisição (para contextos pré-autenticação, ex.: tela de login por subdomínio).

Camadas onde o isolamento precisa ser reforçado e testado:
- **Controllers** — todo endpoint que retorna/mutação dado de negócio exige tenant resolvido por guard antes do handler.
- **Services** — toda query de leitura/escrita passa `tenantId` explicitamente; proibido montar query sem filtro de tenant em entidades multiempresa.
- **Repositories/Prisma** — usar um wrapper/middleware que injeta `tenantId` automaticamente nas operações de entidades multiempresa, reduzindo risco de esquecimento manual.
- **Filas (BullMQ)** — todo job carrega `tenantId` no payload; workers validam e re-checam o tenant antes de processar (nunca assumir que o publisher não teve erro).
- **WebSocket** — conexões autenticadas por tenant; namespace/room por `tenantId`; nunca broadcast global que vaze dados entre tenants.
- **Storage (S3-compatible)** — chaves de objeto prefixadas por `tenantId`; URLs assinadas com expiração curta; bucket privado, nunca público.
- **Cache (Redis)** — chaves de cache namespaced por `tenantId`.
- **Logs** — logs de aplicação não misturam dados de tenants diferentes de forma que permita correlação indevida; nível de log não inclui payload sensível completo em produção.
- **Relatórios/exportações** — toda agregação/exportação filtrada por tenant antes de qualquer `GROUP BY`/join.
- **Webhooks recebidos** (Meta/provedores) — o tenant é resolvido pelo identificador do número/conta que recebeu o evento, nunca por campo livre do payload.

Row-Level Security (RLS) do PostgreSQL é adotado como camada de defesa em profundidade nas tabelas mais sensíveis (ver `DATABASE_DESIGN.md`), complementar — não substituto — ao filtro na aplicação.

## 3. Validação e proteção de entrada/saída

- Validação de DTOs em toda rota (Zod/class-validator), rejeitando payload não esperado (`whitelist`/`forbidNonWhitelisted`).
- Proteção contra SQL injection: uso exclusivo de query builder/ORM parametrizado (Prisma); proibido concatenar SQL cru com input do usuário.
- Proteção contra XSS: sanitização de conteúdo renderizado no frontend (especialmente mensagens de WhatsApp, notas, campos customizados); Content-Security-Policy configurado.
- Proteção contra SSRF: validação/allowlist de destinos em qualquer funcionalidade que busque URL fornecida por usuário (ex.: webhook de saída, importação por URL).
- Validação de uploads: tipo MIME real (não só extensão), tamanho máximo, escaneamento quando aplicável, armazenamento fora do diretório servido publicamente.
- Assinatura de webhooks recebidos (validação de assinatura Meta) e webhooks enviados (assinar payload de saída para o consumidor validar).
- Idempotência: toda operação disparada por evento externo (webhook) ou reprocessamento de fila usa chave de idempotência (`externalId`/`idempotencyKey`) para não duplicar efeito (mensagem duplicada, lead duplicado, cobrança duplicada).

## 4. Autorização

- RBAC aplicado no backend em toda rota, nunca só escondido na UI (ver `PERMISSIONS_MATRIX.md`).
- Toda ação sensível (exclusão, mudança de plano, impersonação, alteração de permissão) exige checagem explícita, não apenas herança implícita de papel "admin".

## 5. Criptografia

- TLS obrigatório em trânsito (HTTPS/WSS) em todos os ambientes exceto localhost de desenvolvimento.
- Segredos (chaves de API de provedores, tokens WhatsApp, credenciais de gateway de pagamento) armazenados em cofre de segredos/variáveis de ambiente do orquestrador — nunca commitados no repositório.
- `.env` nunca versionado; `.env.example` documenta as chaves necessárias sem valores reais.

## 6. Auditoria

Ver estrutura completa da entidade `AuditLog` em `DATABASE_DESIGN.md`. Eventos mínimos obrigatórios: login, logout, recuperação de senha, criação/edição/exclusão de qualquer entidade de negócio, mudança de status, mensagens enviadas, transferências, movimentações de funil, ativação/desativação de módulo, conexão/desconexão de número, mudanças em templates, aceite de risco (conexão não oficial), acesso Master/impersonação, mudanças de plano/módulo/cobrança, ações de afiliados/comissões.

Dados sensíveis (senha, tokens, documentos pessoais completos) são mascarados nos registros de auditoria — nunca armazenados em texto puro no `previousData`/`newData`.

## 7. LGPD e retenção de dados

- Base legal e finalidade documentadas para cada categoria de dado pessoal coletado (contato, CPF/CNPJ, dados de pagamento de afiliados).
- Política de retenção definida por entidade (ex.: mensagens/conversas mantidas conforme plano contratado; logs de auditoria com retenção mínima definida por requisito legal).
- Mecanismo de exportação e exclusão de dados pessoais mediante solicitação, respeitando a preservação de histórico exigida para fins contratuais/fiscais quando aplicável.
- Dados de afiliados (CPF, dados bancários) tratados com o mesmo rigor de dados financeiros — nunca expostos em logs ou respostas de API além do necessário.

## 8. Backups e recuperação

- Backup regular do PostgreSQL e do storage de arquivos, com teste periódico de restauração.
- Rollback de deploy e de migration documentado no processo de CI/CD (ver `DEVELOPMENT_PLAN.md`); nenhuma migration destrutiva roda automaticamente em produção sem etapa de aprovação/proteção.

## 9. Gestão de risco da conexão WhatsApp não oficial

Antes de habilitar automações sobre um número em modalidade não oficial, o sistema exige o aceite de risco descrito na seção 13.8 do prompt mestre (modal obrigatório, registro em `RiskAcceptance`). Nenhuma automação/envio nesse número roda sem esse registro presente.

## 10. Status desta checklist (revisão da Fase 10 — Estabilização)

Revisão item a item feita ao final do desenvolvimento das 10 fases, ver `DEVELOPMENT_PLAN.md` Fase 10 para o detalhamento completo.

**Implementado e testado**: Argon2id; JWT + refresh rotation; cookies HttpOnly/Secure/SameSite; rate limit por IP/rota (`@nestjs/throttler`) em login/signup/recuperação de senha; **bloqueio progressivo por conta** (§1, fechado na Fase 10 — `account-lockout.util.ts`, testado em `account-lockout.spec.ts`); recuperação de senha com token de uso único, expiração de 1h, resposta neutra, e **agora efetivamente enviada** por e-mail via fila (§1, fechado na Fase 10 — antes só gerava o token e descartava); isolamento multi-tenant por `tenantId` do JWT em controllers/services/Prisma wrapper/filas/WebSocket/storage/relatórios (§2, testado em `tenant-isolation.spec.ts` + suíte de isolamento em cada módulo); validação de DTO com `whitelist`/`forbidNonWhitelisted` em toda rota (§3); Prisma parametrizado em 100% das queries, nenhum SQL cru concatenado (§3); assinatura HMAC de webhook Meta validada (§3); idempotência de webhook/automação/follow-up (§3, casos críticos #6/#8/#9); RBAC + `ModuleActiveGuard` em toda rota comercial (§4); `.env` fora do versionamento, `.env.example` sem valores reais (§5); `AuditLog` cobrindo a lista mínima do §6, incluindo os novos eventos `notification.welcome_sent`/`notification.password_reset_sent`; aceite de risco obrigatório antes de qualquer envio em número não oficial (§9, caso crítico #10).

**Débito técnico consciente, registrado deliberadamente (não por omissão)** — decisões de custo/benefício adiadas para um ciclo pós-lançamento orientado por uso real:
- **Row-Level Security do Postgres** (§2): avaliado e conscientemente adiado. O isolamento por `tenantId` já é reforçado e testado em toda camada de aplicação (guard → service → `TenantScopedPrismaService` → auditoria), e a suíte de isolamento cobre tentativas de vazamento cross-tenant em todos os módulos comerciais. Adicionar RLS como camada extra exigiria propagar o `tenantId` como variável de sessão Postgres por requisição (`SET LOCAL` dentro de transação) em todo o caminho de query da aplicação — uma mudança arquitetural ampla que, feita apressadamente, arrisca *sessão de conexão pooled vazando `tenantId` de uma requisição para outra* (pior que a situação atual). Vale a pena revisitar com tempo dedicado, não como item de fechamento de fase.
- **Resolução de tenant por subdomínio** (§2): hoje só por claim do JWT. Sem frontend multi-tenant real neste ciclo, não há consumidor prático para essa rota de resolução ainda; a interface (`Tenant.subdominio`, já único e persistido) está pronta para quando o frontend existir.
- **CSP/sanitização de XSS no frontend** (§3): não aplicável ainda — não há frontend implementado neste ciclo (só API).
- **TLS/HTTPS de produção, backup regular com teste de restauração** (§5, §8): dependem da infraestrutura de deploy real (VPS/Traefik), fora do escopo de um ambiente de desenvolvimento local.
- **LGPD — exportação/exclusão de dados pessoais sob demanda** (§7): soft delete já preserva histórico (`deletedAt` em Contact/Conversation/etc.); um endpoint dedicado de exportação/exclusão mediante solicitação ainda não existe.
