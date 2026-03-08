#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   TARGET_DB_URL=postgresql://... ./scripts/db-restore.sh /tmp/mufessir.dump

if [[ $# -lt 1 ]]; then
  echo "Usage: TARGET_DB_URL=postgresql://... $0 /path/to/input.dump"
  exit 1
fi

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "TARGET_DB_URL is required"
  exit 1
fi

IN_FILE="$1"
if [[ ! -f "$IN_FILE" ]]; then
  echo "Dump file not found: $IN_FILE"
  exit 1
fi

echo "Restoring dump from $IN_FILE"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_DB_URL" "$IN_FILE"
echo "Restore complete"

