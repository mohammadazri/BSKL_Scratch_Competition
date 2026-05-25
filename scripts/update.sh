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

echo "==> pnpm install --frozen-lockfile"
sudo -u "${SERVICE_USER}" pnpm install --frozen-lockfile

echo "==> pnpm build"
sudo -u "${SERVICE_USER}" pnpm build

echo "==> restarting p3-judging service"
sudo systemctl restart p3-judging

sleep 2

sudo systemctl status p3-judging --no-pager
