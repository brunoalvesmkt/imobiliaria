# Build multi-stage: a etapa "build" tem o monorepo inteiro (deps de dev
# incluídas) só para compilar; a imagem final ("runner") leva apenas o
# resultado de `pnpm deploy` — pacote + node_modules podados para produção,
# sem o resto do monorepo. Reduz bastante o tamanho da imagem final.
#
# `COPY . .` de uma vez (em vez de copiar só os package.json antes, na
# esperança de cachear a camada de install) foi uma escolha deliberada
# depois de testar a alternativa: o pnpm workspace tem 7 pacotes em
# packages/* e enumerar cada package.json manualmente é frágil — esquecer
# um (aconteceu com packages/tsconfig e packages/eslint-config na primeira
# tentativa) quebra a resolução de devDependencies workspace:* de forma
# silenciosa. Correção > cache de camada aqui.
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS build
# `git` é exigido em runtime de build pela dependência `libsignal-node` do
# @whiskeysockets/baileys, resolvida via URL git (não um pacote npm comum) —
# tanto no `pnpm install` inicial quanto no `pnpm deploy` mais abaixo, que
# reinstala um node_modules podado do zero.
# openssl aqui também: o `prisma generate` do passo abaixo detecta a versão
# do OpenSSL do ambiente onde roda para decidir o binário "native" — sem o
# pacote instalado, a detecção falha e o Prisma passa a apontar para o
# binário genérico errado independente de `binaryTargets` no schema.
RUN apk add --no-cache git openssl
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @chatbot-saas/database generate
RUN pnpm --filter @chatbot-saas/api... build
RUN pnpm --filter @chatbot-saas/api deploy --prod /out
# `pnpm deploy --prod` reinstala um node_modules isolado do zero para /out —
# o cliente Prisma gerado no passo acima (dentro do node_modules do monorepo)
# não é reaproveitado nesse node_modules novo, então precisa ser gerado de
# novo aqui, agora contra o prisma CLI que sobrevive à poda de produção
# (prisma é dependency, não devDependency, em packages/database/package.json).
# O `.bin/prisma` não é criado nesse node_modules podado (symlink quebrado —
# layout `.pnpm/node_modules/<pkg>` sem segmento de versão, peculiaridade
# observada de `pnpm deploy --prod` neste projeto), por isso chamamos o CLI
# direto pelo caminho real do pacote. Rodar com `cwd` dentro do próprio
# pacote (em vez de passar --schema de fora) é necessário para a resolução
# de módulos do Node encontrar o @prisma/client já podado ali dentro —
# rodando de fora, o Prisma não localiza o pacote e tenta um `npm install`
# de rede (que falha, sandbox sem acesso à internet aqui).
RUN cd /out/node_modules/@chatbot-saas/database && node /out/node_modules/.pnpm/node_modules/prisma/build/index.js generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# O binário do query engine do Prisma precisa de libssl real no sistema — sem
# isso, mesmo com `binaryTargets` corretos no schema.prisma (ver comentário
# lá), o Node não detecta a versão do OpenSSL disponível (mensagem de aviso
# do próprio Prisma: "Please manually install OpenSSL") e cai num binário
# genérico que não carrega.
RUN apk add --no-cache openssl
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
# BaileysConnectionManagerService cria esta pasta em tempo de execução (uma
# subpasta por número conectado, guardando as credenciais da sessão do
# WhatsApp) — sem existir e já pertencer ao usuário não-root "app" de
# antemão, o primeiro `mkdir` dela falha com EACCES (o restante de /app é
# só de leitura/execução para "app", herdado do dono root do WORKDIR).
RUN mkdir -p /app/.baileys-sessions && chown -R app:app /app/.baileys-sessions
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
