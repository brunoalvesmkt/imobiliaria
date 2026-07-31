#!/usr/bin/env bash
# Restaura um backup gerado por backup-postgres.sh. DESTRUTIVO — apaga o
# banco atual antes de restaurar. Pensado para teste periódico de
# restauração (SECURITY.md §5 pede backup "com teste de restauração", não
# só o backup em si) e para recuperação de desastre de verdade.
#
# Uso:
#   ./scripts/restore-postgres.sh ./.docker-data/backups/chatbot_saas_20260730_030000.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

FILE="${1:?Uso: ./scripts/restore-postgres.sh <caminho-do-arquivo.sql.gz>}"
if [ ! -f "$FILE" ]; then
  echo "Arquivo não encontrado: $FILE" >&2
  exit 1
fi

echo "ATENÇÃO: isso vai APAGAR o banco 'chatbot_saas' atual e restaurar a partir de:"
echo "  $FILE"
read -r -p "Digite 'restaurar' para confirmar: " CONFIRM
if [ "$CONFIRM" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

echo "[$(date -Iseconds)] Derrubando conexões ativas e recriando o banco..."
docker compose exec -T postgres psql -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'chatbot_saas' AND pid <> pg_backend_pid();"
docker compose exec -T postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS chatbot_saas;"
docker compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE chatbot_saas;"

echo "[$(date -Iseconds)] Restaurando..."
gunzip -c "$FILE" | docker compose exec -T postgres psql -U postgres -d chatbot_saas

echo "[$(date -Iseconds)] Restauração concluída. Rode 'pnpm --filter database generate' se for continuar operando localmente."
