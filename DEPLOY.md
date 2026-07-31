# Deploy em produção (VPS)

Checklist para colocar a plataforma no ar numa VPS própria, usando o
`docker-compose.yml` já existente no repositório (Postgres, Redis, MinIO,
`api`, `worker`, `web`, e Traefik atrás do profile `production`).

## 1. Pré-requisitos na VPS

- Docker Engine + Docker Compose plugin instalados.
- Dois domínios (ou subdomínios) apontando para o IP da VPS via DNS (registro
  `A`/`AAAA`) **antes** do primeiro deploy. Neste projeto, o subdomínio
  provisório definido é `chatbot.agenciaclamber.com.br` (frontend) e
  `api.chatbot.agenciaclamber.com.br` (backend) — ver seção 7 para o processo
  de trocar para o domínio oficial mais tarde. O desafio HTTP-01 do Let's
  Encrypt falha se o DNS ainda não tiver propagado.
- Firewall (`ufw` ou equivalente) liberando só `22` (SSH), `80` e `443`. Todas
  as outras portas (Postgres, Redis, MinIO, api/web diretos) já publicam só em
  `127.0.0.1` no `docker-compose.yml` — não ficam expostas externamente mesmo
  sem regra de firewall, mas manter o firewall restritivo é defesa em
  profundidade, não um substituto para isso.

## 2. Preparar o `.env` de produção

```bash
cp .env.example .env
```

Preencha pelo menos:

| Variável | O que é |
|---|---|
| `APP_DOMAIN`, `API_DOMAIN` | `chatbot.agenciaclamber.com.br` e `api.chatbot.agenciaclamber.com.br` (subdomínio provisório — ver seção 7 para trocar depois) |
| `ACME_EMAIL` | e-mail para avisos de expiração do Let's Encrypt |
| `NEXT_PUBLIC_API_URL` | `https://api.chatbot.agenciaclamber.com.br` — **build-time**, não runtime (ver nota abaixo) |
| `APP_URL` | `https://chatbot.agenciaclamber.com.br` (usado para CORS pela API) |
| `COOKIE_DOMAIN` | `chatbot.agenciaclamber.com.br` — domínio-pai comum a `APP_DOMAIN`/`API_DOMAIN`, obrigatório em produção (ver nota abaixo) |
| `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | troque os padrões de dev |
| `DATABASE_URL` | mesma senha do `POSTGRES_PASSWORD` acima |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | `openssl rand -hex 48` cada um |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `MASTER_SEED_EMAIL`, `MASTER_SEED_PASSWORD` | login do primeiro super admin |
| `META_*`, `STRIPE_*`, `AI_PLATFORM_*` | credenciais reais dos provedores que forem usar (podem ficar em branco por enquanto — o módulo correspondente simplesmente fica indisponível até serem preenchidas) |
| `WHATSAPP_UNOFFICIAL_PROVIDER` | `baileys_unofficial` (padrão) para a ponte real, ou `fake_unofficial` para manter simulado |

> **`NEXT_PUBLIC_API_URL` é lido em build time, não em runtime** — o Next.js
> embute o valor no bundle JavaScript quando compila. Trocar essa variável no
> `.env` depois de já ter feito o build **não tem efeito** até reconstruir a
> imagem do `web` (`docker compose build web`). Isso é comportamento do
> Next.js, não um bug daqui.

> **`COOKIE_DOMAIN` é obrigatório em produção** (bug real descoberto no
> primeiro deploy desta sessão): os cookies de sessão (JWT) são criados pela
> API, mas o `middleware.ts` que valida a sessão roda no servidor do `web` —
> um domínio diferente. Sem `COOKIE_DOMAIN` explícito, o cookie fica preso
> ao host exato que o criou (a API) e o navegador nunca o reenvia pro
> painel — o login parece funcionar (retorna `200`, seta o cookie) mas o
> painel redireciona de volta pro login em seguida, sem erro visível na
> tela. O valor precisa ser o domínio-pai comum a `APP_DOMAIN` e
> `API_DOMAIN` (ex.: se são `chatbot.agenciaclamber.com.br` e
> `api.chatbot.agenciaclamber.com.br`, use `COOKIE_DOMAIN=chatbot.agenciaclamber.com.br`).
> Exige rebuild do `api` depois de setar (`docker compose build api`).

## 3. Primeiro deploy

Antes de tudo, decida qual dos dois cenários de Traefik se aplica — **só pode
haver um dono das portas 80/443 por servidor**:

- **Traefik dedicado a este projeto** (`docker compose -f docker-compose.yml
  -f docker-compose.traefik-standalone.yml`) — use quando a VPS não tem
  nenhum outro Traefik rodando. Emite certificado via desafio HTTP-01.
- **Reaproveitar um Traefik que já roda na VPS para outro projeto**
  (`docker compose -f docker-compose.yml -f
  docker-compose.traefik-shared.yml`) — quando as portas 80/443 já estão
  ocupadas por outro Traefik. Este projeto **não** entra na rede do outro
  projeto inteiro (risco real, descoberto em produção: se o outro projeto
  também tiver `postgres`/`redis`/`minio` nessa rede, os nomes colidem e o
  DNS interno do Docker pode resolver pro container errado — ver aviso no
  topo de `docker-compose.traefik-shared.yml`). Em vez disso, cria uma rede
  pequena e exclusiva, e você conecta o Traefik existente a ela manualmente
  (um comando, uma vez só). Exige `TRAEFIK_CERTRESOLVER` preenchido no
  `.env` — ver comentários no topo de `docker-compose.traefik-shared.yml`
  para o passo a passo completo.

Os comandos abaixo usam `$COMPOSE_FILES` como abreviação — substitua pelas
flags `-f` do cenário escolhido (ex.: `-f docker-compose.yml -f
docker-compose.traefik-standalone.yml`).

```bash
docker compose $COMPOSE_FILES build
docker compose $COMPOSE_FILES up -d postgres redis minio
# espera os healthchecks (docker compose ps) antes de aplicar migrations
docker compose $COMPOSE_FILES run --rm api sh -c "cd node_modules/@chatbot-saas/database && node /app/node_modules/.pnpm/node_modules/prisma/build/index.js migrate deploy"
docker compose $COMPOSE_FILES run --rm api node node_modules/@chatbot-saas/database/dist/seed.js   # cria o Master seed
docker compose $COMPOSE_FILES --profile production up -d   # --profile production só tem efeito com o standalone (é o que ativa o serviço "traefik")
```

> **Por que não `pnpm --filter database migrate:deploy`/`pnpm --filter
> database seed`, como um monorepo normal faria?** A imagem de produção do
> `api` é gerada via `pnpm deploy --prod` (ver Dockerfile) — um pacote
> enxuto só com o necessário pra rodar `node dist/main.js`, sem o restante
> do monorepo nem um `pnpm` funcional lá dentro. Os comandos acima chamam o
> Prisma e o seed compilado diretamente via `node`, contornando isso —
> testado de ponta a ponta nesta sessão contra uma VPS real.

O Traefik dedicado só sobe com `--profile production` (flag que só existe no
`docker-compose.traefik-standalone.yml`); sem essa flag, `docker compose up`
continua funcionando como ambiente de dev local (portas diretas em
`127.0.0.1`, sem TLS). No cenário de Traefik compartilhado, não use
`--profile production` — não há serviço `traefik` nesse arquivo pra ativar.

## 4. Verificação pós-deploy

- `docker compose ps` — todos os serviços `healthy`/`running`.
- `curl -I https://api.chatbot.agenciaclamber.com.br/health` (ou qualquer
  rota pública) — confirma TLS válido e a API respondendo atrás do Traefik.
- Login como o Master seed em
  `https://chatbot.agenciaclamber.com.br/master/login`.
- `docker compose logs traefik | grep acme` — confirma que o certificado foi
  emitido sem erro (a primeira emissão pode levar até ~1 minuto).

## 5. Backup

```bash
./scripts/backup-postgres.sh
```

Agende via cron (exemplo diário às 3h, mantendo 14 dias — ver comentário no
próprio script para o comando):

```
0 3 * * * cd /caminho/do/projeto && ./scripts/backup-postgres.sh >> /var/log/chatbot-saas-backup.log 2>&1
```

**Teste a restauração pelo menos uma vez antes de confiar no backup** — um
backup nunca testado não é um backup, é uma esperança:

```bash
./scripts/restore-postgres.sh ./.docker-data/backups/chatbot_saas_<timestamp>.sql.gz
```

## 6. Atualizando uma versão já em produção

```bash
git pull
docker compose $COMPOSE_FILES build
docker compose $COMPOSE_FILES run --rm api sh -c "cd node_modules/@chatbot-saas/database && node /app/node_modules/.pnpm/node_modules/prisma/build/index.js migrate deploy"
docker compose $COMPOSE_FILES up -d   # + --profile production, só no cenário standalone
```

(`$COMPOSE_FILES` é a mesma abreviação da seção 3 — as flags `-f` do cenário
de Traefik escolhido no primeiro deploy.)

O `migrate deploy` do Prisma (diferente do `migrate dev` usado em
desenvolvimento) é não-interativo e só aplica migrations pendentes — nunca
gera uma nova a partir do schema, então é seguro rodar em produção.

## 7. Trocando de domínio depois (ex.: subdomínio provisório → domínio oficial)

Nada no `docker-compose.yml` tem domínio fixo — tudo vem de `APP_DOMAIN`,
`API_DOMAIN`, `NEXT_PUBLIC_API_URL` e `APP_URL` no `.env`. Trocar depois é
seguro e não exige recriar nada do zero:

1. Aponte o DNS do domínio novo para o mesmo IP da VPS **antes** de trocar o
   `.env` (mesma regra do primeiro deploy — o desafio HTTP-01 do Let's
   Encrypt falha se o DNS não tiver propagado ainda).
2. Atualize no `.env`: `APP_DOMAIN`, `API_DOMAIN`, `NEXT_PUBLIC_API_URL` e
   `APP_URL` para o domínio novo.
3. Reconstrua **só o `web`** e suba tudo de novo:

   ```bash
   docker compose --profile production build web
   docker compose --profile production up -d
   ```

   `NEXT_PUBLIC_API_URL` é embutido no bundle em build-time (ver nota na
   seção 2) — por isso o `web` precisa rebuild. `api`/`worker` leem
   `APP_URL`/`API_DOMAIN` em runtime, não precisam.
4. O Traefik detecta o novo `Host()` nas labels automaticamente e emite um
   certificado Let's Encrypt novo para o domínio novo na primeira requisição
   — confirme com `docker compose logs traefik | grep acme`, igual na
   verificação pós-deploy da seção 4. O certificado antigo (do subdomínio
   provisório) simplesmente para de ser renovado; não precisa remover nada
   manualmente.
5. **Sessões do Baileys não são afetadas** — ficam salvas em disco
   (`WHATSAPP_SESSIONS_DIR`) e não dependem de domínio, então números já
   conectados continuam funcionando sem precisar escanear QR de novo.
6. **Se usar o provedor oficial da Meta** (não o Baileys): o webhook
   cadastrado no painel de desenvolvedor da Meta aponta para a URL antiga
   (`https://api.<domínio-provisório>/...`) — precisa atualizar lá
   manualmente para a URL do domínio novo, ou os webhooks param de chegar.

## 8. Débitos técnicos conscientes que continuam abertos após este checklist

Documentados com mais detalhe em `SECURITY.md` e `DEVELOPMENT_PLAN.md`; nenhum
deles impede o deploy, mas vale ter ciência:

- **Row-Level Security do Postgres**: a infraestrutura existe no banco
  (`app_runtime`, políticas por tenant — ver migration da Fase 19), mas a
  aplicação ainda conecta como o papel dono das tabelas (`DATABASE_URL`), que
  o Postgres nunca sujeita a RLS por design. O isolamento entre empresas hoje
  é garantido inteiramente pela camada de aplicação
  (`TenantScopedPrismaService`, testado em `row-level-security.spec.ts` e
  `tenant-isolation.spec.ts`) — RLS seria uma camada extra de defesa, não a
  única. Ligar de verdade é um refactor que toca todo ponto de acesso ao
  banco (dezenas de serviços) — arriscado demais para fazer apressado junto
  de uma preparação de deploy.
- **RBAC granular**: só o papel "admin" existe por padrão; não há tela para o
  tenant criar papéis customizados com permissões reduzidas (ex.: para o
  mascaramento de CPF/CNPJ da Fase 56 fazer diferença na prática).
- **Ponte WhatsApp não oficial real (Baileys)**: funciona, mas exige o
  usuário escanear um QR com um telefone de verdade — nenhum ambiente
  automatizado ou este checklist consegue validar essa parte previamente.
- **Dockerfiles**: multi-stage com `pnpm deploy --prod` (api/worker) e saída
  `standalone` do Next.js (web). As três imagens (`api`, `worker`, `web`)
  foram de fato construídas com `docker build` e testadas subindo o container
  (`docker run`) nesta sessão — não é uma suposição. Isso revelou e corrigiu
  6 bugs reais que só apareciam em runtime de produção, nenhum visível em dev:
  1. Faltavam `package.json` de alguns pacotes do workspace na imagem (o
     `COPY` seletivo esquecia `packages/tsconfig` e `packages/eslint-config`)
     — resolvido com `.dockerignore` + `COPY . .` do monorepo inteiro.
  2. `pnpm deploy --prod` falhava resolvendo a dependência do Baileys
     (`libsignal-node`, instalada via URL git) porque a imagem `alpine` não
     tem `git` — resolvido com `apk add git` no estágio de build da API.
  3. `packages/database` e `packages/validation` tinham `main`/`types`
     apontando pro `.ts` cru (sem build) — funcionava em dev via
     ts-node/Next, mas quebrava com `SyntaxError: Unexpected token 'export'`
     ao rodar o `node dist/main.js` compilado em produção. Corrigido dando
     aos dois um build real (`tsc`, alvo CommonJS) rodado automaticamente no
     `prepare` do pnpm.
  4. `pnpm deploy --prod` recria um `node_modules` isolado do zero que não
     herda o Prisma Client já gerado, e o `.bin/prisma` fica com link
     quebrado nesse `node_modules` podado — corrigido chamando o CLI do
     Prisma pelo caminho real do pacote, com `cwd` dentro do próprio pacote
     `@chatbot-saas/database` no `/out`.
  5. A imagem `node:20-alpine` não tem a `libssl` que o binário do query
     engine do Prisma precisa pra carregar (`Error loading shared library
     libssl.so.1.1`) — corrigido com `binaryTargets = ["native",
     "linux-musl-openssl-3.0.x"]` no `schema.prisma` e `apk add openssl` nos
     estágios de build e de runtime das imagens de `api` e `worker`.
  6. A página `/cadastro` do painel (`apps/web`) usava `useSearchParams()`
     sem um `<Suspense>` ao redor, o que quebra o `next build` em produção
     (`Export encountered errors... /cadastro`) — corrigido envolvendo o
     formulário num `<Suspense>`.

  Bônus encontrado ao investigar o bug 3: a mesma correção (CommonJS em
  `packages/database`/`packages/validation`) também resolveu, como efeito
  colateral, o bug antigo do servidor de desenvolvimento (Node v24) que
  travava com `ERR_MODULE_NOT_FOUND` e bloqueava a verificação em navegador
  desde a Fase 46 — `pnpm dev` da API agora sobe limpo. Ver
  `DEVELOPMENT_PLAN.md`.
