#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cat <<'EOF'
Neon import prep
1. Ensure DATABASE_URL or DIRECT_URL points at the target Neon database.
2. Use db/reference/reference-dump.sql or reference/check-in-shuttle-buses-api/dump.sql as the source.
3. Import with a local postgres client or a postgres Docker container, for example:

   docker run --rm -i postgres:16-alpine \
     sh -lc 'psql "$DATABASE_URL"' < db/reference/reference-dump.sql

4. Run the verification checklist in docs/verification-checklist.md afterwards.
EOF
