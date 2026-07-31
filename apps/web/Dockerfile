# Build multi-stage usando a saída "standalone" do Next.js (next.config.js)
# — server.js autocontido com só os módulos realmente importados, bem menor
# que copiar node_modules do monorepo inteiro para a imagem final.
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @chatbot-saas/database generate
# NEXT_PUBLIC_* é embutido no bundle em tempo de build, não lido em runtime —
# precisa entrar como build arg (ver docker-compose.yml, build.args do serviço "web"),
# `env_file` sozinho não teria efeito nenhum aqui.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @chatbot-saas/web... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
# A saída "standalone" espelha o caminho do pacote dentro do monorepo — ver
# https://nextjs.org/docs/app/api-reference/config/next-config-js/output.
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
USER app
WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
