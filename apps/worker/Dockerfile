# Build multi-stage: mesmo padrão do apps/api/Dockerfile — `pnpm deploy --prod`
# gera um pacote autocontido com node_modules podados para produção. Ver
# comentário em apps/api/Dockerfile sobre por que `COPY . .` de uma vez em
# vez de copiar package.json por pacote manualmente.
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS build
# openssl: o `prisma generate` abaixo detecta a versão do OpenSSL do
# ambiente pra escolher o binário certo do query engine — ver comentário
# equivalente em apps/api/Dockerfile.
RUN apk add --no-cache openssl
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @chatbot-saas/database generate
RUN pnpm --filter @chatbot-saas/worker... build
RUN pnpm --filter @chatbot-saas/worker deploy --prod /out
# Ver comentário equivalente em apps/api/Dockerfile — o cliente Prisma
# gerado acima não sobrevive ao node_modules isolado que `pnpm deploy --prod`
# recria para /out. O `.bin/prisma` não é criado nesse node_modules podado
# (symlink quebrado — layout `.pnpm/node_modules/<pkg>` sem segmento de
# versão, peculiaridade observada de `pnpm deploy --prod` neste projeto),
# por isso chamamos o CLI direto pelo caminho real do pacote, com `cwd`
# dentro do próprio pacote — de fora, o Prisma não localiza o @prisma/client
# já podado ali e tenta um `npm install` de rede, que falha no sandbox.
RUN cd /out/node_modules/@chatbot-saas/database && node /out/node_modules/.pnpm/node_modules/prisma/build/index.js generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Ver comentário em apps/api/Dockerfile — libssl real precisa estar presente
# pro binário do query engine do Prisma carregar em runtime.
RUN apk add --no-cache openssl
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out ./
USER app
CMD ["node", "dist/main.js"]
