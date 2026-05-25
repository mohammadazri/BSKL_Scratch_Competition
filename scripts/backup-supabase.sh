#!/usr/bin/env bash
#
# backup-supabase.sh — pg_dump the Supabase Postgres DB to local/USB storage.
#
# Writes a custom-format dump (pg_restore-compatible) and keeps the most recent
# 24 dumps. Intended to be run from cron during event day (every 5 minutes) for
# a tight RPO; outside the event, run on demand.
#
# Required env (from /opt/p3-judging/.env or the cron environment):
#   DATABASE_URL   — Postgres connection string for Supabase
#                    e.g. postgres://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
#
# Optional env:
#   BACKUP_DIR     (default: /media/usb/p3-backups)
#   KEEP           (default: 24)  number of dumps to retain
#
# Restore (manual):
#   pg_restore --clean --if-exists -d "$DATABASE_URL" /path/to/p3-judging-<ts>.dump
#
# Cron example (event day only):
#   */5 * * * * DATABASE_URL=... /opt/p3-judging/scripts/backup-supabase.sh >> /var/log/p3-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/media/usb/p3-backups}"
KEEP="${KEEP:-24}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is not set. Source /opt/p3-judging/.env or pass it in the cron environment."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "FATAL: pg_dump not found. Install postgresql-client (install-pi.sh does this)."
  exit 1
fi

# Ensure backup destination exists and is writable.
if ! mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
  echo "FATAL: cannot create BACKUP_DIR=${BACKUP_DIR}. Is the USB drive mounted?"
  exit 1
fi
if [[ ! -w "${BACKUP_DIR}" ]]; then
  echo "FATAL: BACKUP_DIR=${BACKUP_DIR} is not writable by user $(id -un)."
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/p3-judging-${TS}.dump"

echo "==> dumping to ${OUT}"
pg_dump "${DATABASE_URL}" -Fc -f "${OUT}"

# Sanity check: non-empty file.
if [[ ! -s "${OUT}" ]]; then
  echo "FATAL: dump file is empty: ${OUT}"
  exit 1
fi

echo "    ok — $(du -h "${OUT}" | cut -f1)"

echo "==> rotating: keeping last ${KEEP} dumps in ${BACKUP_DIR}"
# List newest-first, skip the first KEEP, delete the rest. xargs -r is a no-op
# when the input is empty.
ls -1t "${BACKUP_DIR}"/p3-judging-*.dump 2>/dev/null \
  | tail -n +$((KEEP + 1)) \
  | xargs -r rm -v --

echo "==> backup complete: ${OUT}"
