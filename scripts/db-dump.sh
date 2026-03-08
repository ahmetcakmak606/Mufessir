#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DATABASE_URL=postgresql://... ./scripts/db-dump.sh /tmp/mufessir.dump

if [[ $# -lt 1 ]]; then
  echo "Usage: DATABASE_URL=postgresql://... $0 /path/to/output.dump"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

OUT_FILE="$1"
mkdir -p "$(dirname "$OUT_FILE")"

echo "Creating dump at $OUT_FILE"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$OUT_FILE"
echo "Dump complete"

