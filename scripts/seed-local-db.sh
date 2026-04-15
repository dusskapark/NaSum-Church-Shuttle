#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DUMP_FILE="$ROOT_DIR/reference/check-in-shuttle-buses-api/dump.sql"
CONTAINER_NAME="nasum-church-shuttle-db"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres >/dev/null
docker exec "$CONTAINER_NAME" sh -lc 'until pg_isready -U shuttle -d nasum_shuttle >/dev/null 2>&1; do sleep 1; done'
docker exec -i "$CONTAINER_NAME" psql -U shuttle -d nasum_shuttle < "$DUMP_FILE"

echo "Seeded local database from $DUMP_FILE"
