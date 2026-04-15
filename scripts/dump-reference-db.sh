#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DUMP="$ROOT_DIR/reference/check-in-shuttle-buses-api/dump.sql"
TARGET_DUMP="$ROOT_DIR/db/reference/reference-dump.sql"

mkdir -p "$(dirname "$TARGET_DUMP")"
cp "$SOURCE_DUMP" "$TARGET_DUMP"

echo "Copied reference dump to $TARGET_DUMP"
