#!/usr/bin/env bash
# Backup do Postgres via pg_dump, rodando dentro do próprio container
# (docker-compose.yml, serviço "postgres") — não depende de ter o cliente
# psql/pg_dump instalado no host. Pensado para rodar via cron na VPS.
#
# Uso manual:
#   ./scripts/backup-postgres.sh
#
# Uso agendado (cron, diário às 3h da manhã, mantém os últimos 14 dias):
#   0 3 * * * cd /caminho/do/projeto && ./scripts/backup-postgres.sh >> /var/log/chatbot-saas-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./.docker-data/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
# Nome do banco não é sempre "chatbot_saas" — deployments que customizam
# DATABASE_URL (ex.: nome do projeto no domínio) usam outro nome. Extrai do
# .env quando existir; DB_NAME explícito no ambiente sempre tem prioridade.
DB_NAME="${DB_NAME:-}"
if [ -z "$DB_NAME" ] && [ -f .env ]; then
  DB_NAME="$(grep -m1 '^DATABASE_URL=' .env | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')"
fi
DB_NAME="${DB_NAME:-chatbot_saas}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Iniciando backup do banco \"${DB_NAME}\" -> ${BACKUP_DIR}/${FILENAME}"

docker compose exec -T postgres pg_dump -U postgres --format=plain --no-owner --no-privileges "$DB_NAME" \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date -Iseconds)] Backup concluído (${SIZE})."

# Expurga backups mais antigos que RETENTION_DAYS — mantém o disco da VPS previsível.
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -Iseconds)] Backups com mais de ${RETENTION_DAYS} dias removidos."
