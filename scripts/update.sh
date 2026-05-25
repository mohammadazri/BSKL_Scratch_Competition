#!/usr/bin/env bash
#
# update.sh — pull-and-restart deploy for the P3 Judging site.
#
# Run on the Pi after a `git push` to main. No downtime for typical updates
# (systemd restart is sub-second).
#
# Optional env:
#   APP_DIR        (default: /opt/p3-judging)
#   SERVICE_USER   (default: p3judge)
#
# Usage:
#   ./scripts/update.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/p3-judging}"
SERVICE_USER="${SERVICE_USER:-p3judge}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "FATAL: ${APP_DIR} is not a git checkout. Did install-pi.sh run?"
  exit 1
fi

cd "${APP_DIR}"

echo "==> git pull --ff-only"
sudo -u "${SERVICE_USER}" git pull --ff-only

# Brand-asset gate: refuse to deploy without official logos in static/brand/.
# Mirrors the check in install-pi.sh so a stray git push that drops a logo
# can never reach production.
echo "==> verifying brand assets present"
P3_OK=0
BSKL_OK=0
for ext in svg png; do
  [[ -s "static/brand/p3-logo.${ext}"   ]] && P3_OK=1
  [[ -s "static/brand/bskl-logo.${ext}" ]] && BSKL_OK=1
done
if [[ "${P3_OK}" -ne 1 ]]; then
  echo "FATAL: P3 logo missing or empty in static/brand/ (expected p3-logo.svg or p3-logo.png)."
  echo "       Replace placeholders per TODO_BRAND_ASSETS.md before deploying."
  exit 1
fi
if [[ "${BSKL_OK}" -ne 1 ]]; then
  echo "FATAL: BSKL logo missing or empty in static/brand/ (expected bskl-logo.svg or bskl-logo.png)."
  echo "       Replace placeholders per TODO_BRAND_ASSETS.md before deploying."
  exit 1
fi

echo "==> pnpm install --frozen-lockfile"
sudo -u "${SERVICE_USER}" pnpm install --frozen-lockfile

echo "==> pnpm build"
sudo -u "${SERVICE_USER}" pnpm build

echo "==> restarting p3-judging service"
sudo systemctl restart p3-judging

sleep 2

sudo systemctl status p3-judging --no-pager
