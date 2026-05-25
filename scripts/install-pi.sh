#!/usr/bin/env bash
#
# install-pi.sh — first-time installer for the P3 Judging site on a Raspberry Pi.
#
# Target: Raspberry Pi 4/5 (ARM64), Raspberry Pi OS 64-bit (Bookworm or later).
# Idempotent where reasonable — safe to re-run, but inspect output for skipped steps.
#
# Required env:
#   REPO_URL   — git URL of the judging-site repo (https or ssh).
#
# Optional env:
#   APP_DIR        (default: /opt/p3-judging)
#   SERVICE_USER   (default: p3judge)
#
# Usage:
#   REPO_URL="https://github.com/<you>/judging-site.git" ./scripts/install-pi.sh

set -euo pipefail

REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/opt/p3-judging}"
SERVICE_USER="${SERVICE_USER:-p3judge}"
NODE_MAJOR=20

if [[ -z "${REPO_URL}" ]]; then
  echo "FATAL: REPO_URL is not set."
  echo "       Re-run with: REPO_URL=\"https://github.com/<you>/judging-site.git\" ./scripts/install-pi.sh"
  exit 1
fi

if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "WARNING: this script targets ARM64 (aarch64). Detected: $(uname -m)"
  echo "         Continuing in 3s — Ctrl-C to abort."
  sleep 3
fi

echo "==> installing system packages (curl, git, ca-certificates, gnupg, postgresql-client)"
sudo apt-get update
sudo apt-get install -y curl git ca-certificates gnupg postgresql-client

echo "==> installing Node.js ${NODE_MAJOR}.x from NodeSource (do NOT use Debian's nodejs)"
if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "    Node $(node --version) already installed — skipping."
fi

echo "==> installing pnpm globally via npm"
if ! command -v pnpm >/dev/null 2>&1; then
  sudo npm install -g pnpm
else
  echo "    pnpm $(pnpm --version) already installed — skipping."
fi

echo "==> installing cloudflared (ARM64 .deb from GitHub releases)"
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb \
    -o /tmp/cloudflared.deb
  sudo dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
else
  echo "    cloudflared $(cloudflared --version 2>&1 | head -n1) already installed — skipping."
fi

echo "==> ensuring service user '${SERVICE_USER}' exists"
if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  sudo useradd --system --create-home --shell /bin/bash "${SERVICE_USER}"
  echo "    created user '${SERVICE_USER}'."
else
  echo "    user '${SERVICE_USER}' already exists — skipping."
fi

echo "==> preparing application directory ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "==> cloning repo into ${APP_DIR}"
  sudo -u "${SERVICE_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "==> repo already cloned at ${APP_DIR} — pulling latest"
  sudo -u "${SERVICE_USER}" git -C "${APP_DIR}" pull --ff-only
fi

cd "${APP_DIR}"

echo "==> verifying brand assets present and non-empty (fail-loud if missing)"
P3_OK=0
BSKL_OK=0
for ext in svg png; do
  if [[ -s "static/brand/p3-logo.${ext}" ]]; then
    P3_OK=1
  fi
  if [[ -s "static/brand/bskl-logo.${ext}" ]]; then
    BSKL_OK=1
  fi
done

if [[ "${P3_OK}" -ne 1 ]]; then
  echo "FATAL: P3 logo missing or empty."
  echo "       Expected non-empty file at static/brand/p3-logo.svg or static/brand/p3-logo.png"
  exit 1
fi
if [[ "${BSKL_OK}" -ne 1 ]]; then
  echo "FATAL: BSKL logo missing or empty."
  echo "       Expected non-empty file at static/brand/bskl-logo.svg or static/brand/bskl-logo.png"
  exit 1
fi
echo "    brand assets OK."

echo "==> installing dependencies (frozen lockfile)"
sudo -u "${SERVICE_USER}" pnpm install --frozen-lockfile

echo "==> building production bundle"
sudo -u "${SERVICE_USER}" pnpm build

echo "==> installing systemd unit"
sudo cp systemd/p3-judging.service /etc/systemd/system/p3-judging.service
sudo systemctl daemon-reload
sudo systemctl enable p3-judging.service

echo
echo "============================================================"
echo "  install complete."
echo "============================================================"
echo
echo "  NEXT STEPS (manual — required before the service will run):"
echo
echo "  1. Create ${APP_DIR}/.env from .env.example, filling in:"
echo "       VITE_SUPABASE_URL"
echo "       VITE_SUPABASE_ANON_KEY"
echo "       SUPABASE_SERVICE_ROLE_KEY"
echo "       DATABASE_URL              (for backup-supabase.sh)"
echo "     Set ownership: sudo chown ${SERVICE_USER}:${SERVICE_USER} ${APP_DIR}/.env"
echo "     Restrict perms: sudo chmod 600 ${APP_DIR}/.env"
echo "     NOTE: systemd EnvironmentFile does NOT expand \${VAR} — use literal values."
echo
echo "  2. Authenticate cloudflared (one-time, opens a browser):"
echo "       cloudflared tunnel login"
echo "     If the Pi is headless, run this on a desktop and copy ~/.cloudflared/cert.pem to the Pi."
echo
echo "  3. Create the tunnel and note the UUID it prints:"
echo "       cloudflared tunnel create p3-judging"
echo
echo "  4. Configure cloudflared:"
echo "       sudo mkdir -p /etc/cloudflared"
echo "       sudo cp cloudflared/config.example.yml /etc/cloudflared/config.yml"
echo "       sudo \$EDITOR /etc/cloudflared/config.yml   # replace UUID + hostname"
echo "       sudo cp ~/.cloudflared/<UUID>.json /etc/cloudflared/"
echo
echo "  5. Add DNS in Cloudflare dashboard:"
echo "       judging.<your-domain>.com  CNAME  <UUID>.cfargotunnel.com  (proxied / orange cloud)"
echo
echo "  6. Install cloudflared as a system service and start everything:"
echo "       sudo cloudflared service install"
echo "       sudo systemctl start p3-judging cloudflared"
echo "       sudo systemctl status p3-judging --no-pager"
echo
echo "  7. (Optional) Add a Cloudflare Access policy in the Zero Trust dashboard"
echo "     to email-allowlist judges + viewers before the login page loads."
echo
