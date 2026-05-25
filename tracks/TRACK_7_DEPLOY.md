# Track 7 — Raspberry Pi + Cloudflare Tunnel deployment

**Goal:** ship the SvelteKit app to Mohammad's Raspberry Pi behind a Cloudflare Zero Trust Tunnel — public HTTPS URL, no port forwarding, no Let's Encrypt.

**Depends on:** Track 0 merged. Can run in parallel with Tracks 1–6.

**Blocks:** nothing (independent infra).

**Branch:** `track/7-deploy`

**Inputs to read first:**

- [../DEVELOPMENT.md](../DEVELOPMENT.md) § 8 (deployment overview)
- [../DESIGN.md](../DESIGN.md) § 1 (logo verification step — install must refuse to start without logos)

---

## Target environment

- **Hardware:** Raspberry Pi 5 (4 or 8 GB) or Pi 4 (4 GB+). ARM64.
- **OS:** Raspberry Pi OS 64-bit (Bookworm or later).
- **Network:** Pi has internet access; Cloudflare account with a domain Mohammad controls.

---

## Deliverables

### `scripts/install-pi.sh` — first-time install on a fresh Pi

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-}"
APP_DIR="${APP_DIR:-/opt/p3-judging}"
SERVICE_USER="${SERVICE_USER:-p3judge}"
NODE_MAJOR=20

echo "→ installing system deps"
sudo apt-get update
sudo apt-get install -y curl git ca-certificates gnupg

echo "→ installing node ${NODE_MAJOR}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

echo "→ installing cloudflared"
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

echo "→ creating service user"
if ! id "${SERVICE_USER}" &>/dev/null; then
  sudo useradd --system --create-home --shell /bin/bash "${SERVICE_USER}"
fi

echo "→ cloning repo to ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown "${SERVICE_USER}:${SERVICE_USER}" "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo -u "${SERVICE_USER}" git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

echo "→ verifying brand assets present (fail-loud if missing)"
test -s static/brand/p3-logo.png   || test -s static/brand/p3-logo.svg   || { echo "FATAL: p3 logo missing in static/brand/"; exit 1; }
test -s static/brand/bskl-logo.png || test -s static/brand/bskl-logo.svg || { echo "FATAL: bskl logo missing in static/brand/"; exit 1; }

echo "→ install deps + build"
sudo -u "${SERVICE_USER}" pnpm install --frozen-lockfile
sudo -u "${SERVICE_USER}" pnpm build

echo "→ installing systemd unit"
sudo cp systemd/p3-judging.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable p3-judging.service

echo
echo "✓ install complete. Next steps (manual):"
echo "  1. Create /opt/p3-judging/.env from .env.example with Supabase keys"
echo "  2. cloudflared tunnel login         (one-time, opens browser)"
echo "  3. cloudflared tunnel create p3-judging"
echo "  4. cp cloudflared/config.example.yml /etc/cloudflared/config.yml; edit hostnames"
echo "  5. sudo cloudflared service install"
echo "  6. sudo systemctl start p3-judging cloudflared"
```

### `scripts/update.sh` — pull-and-restart deploy

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/p3-judging}"
cd "${APP_DIR}"

echo "→ git pull"
sudo -u p3judge git pull --ff-only

echo "→ install + build"
sudo -u p3judge pnpm install --frozen-lockfile
sudo -u p3judge pnpm build

echo "→ restart service"
sudo systemctl restart p3-judging
sleep 2
sudo systemctl status p3-judging --no-pager
```

### `systemd/p3-judging.service`

```ini
[Unit]
Description=P3 Judging website (SvelteKit on Node)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=p3judge
Group=p3judge
WorkingDirectory=/opt/p3-judging
EnvironmentFile=/opt/p3-judging/.env
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### `cloudflared/config.example.yml`

```yaml
# /etc/cloudflared/config.yml
# Run once: cloudflared tunnel login → creates ~/.cloudflared/cert.pem
# Then:     cloudflared tunnel create p3-judging → gives you the tunnel UUID below
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: /etc/cloudflared/<YOUR-TUNNEL-UUID>.json

ingress:
  - hostname: judging.<your-domain>.com
    service: http://localhost:3000
  - service: http_status:404
```

DNS: in Cloudflare dashboard → DNS → add a CNAME for `judging` pointing to `<YOUR-TUNNEL-UUID>.cfargotunnel.com`, proxied (orange cloud).

(Optional) Cloudflare Access:

- Zero Trust dashboard → Access → Applications → add `judging.<your-domain>.com`
- Policy: emails in (`aiman0608@gmail.com`, 4 judges' emails, viewer emails)

### `scripts/backup-supabase.sh` — pg_dump to USB or local disk

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
DEST="${BACKUP_DIR:-/media/usb/p3-backups}"
mkdir -p "${DEST}"
pg_dump "${DATABASE_URL}" -Fc -f "${DEST}/p3-judging-${TS}.dump"
echo "✓ backup written: ${DEST}/p3-judging-${TS}.dump"
# Keep last 24 only:
ls -1t "${DEST}"/p3-judging-*.dump | tail -n +25 | xargs -r rm
```

Add a crontab entry that runs every 5 minutes during event day (Mohammad will enable on the morning of):

```cron
*/5 * * * * /opt/p3-judging/scripts/backup-supabase.sh >> /var/log/p3-backup.log 2>&1
```

### `scripts/README.md`

One-page operator runbook: install, update, backup, restore, logs (`journalctl -u p3-judging -f`), tunnel status (`cloudflared tunnel info p3-judging`).

---

## Commit checkpoints

1. `deploy: add install-pi.sh with node, pnpm, cloudflared install`
2. `deploy: add systemd unit for p3-judging app`
3. `deploy: add cloudflared example config and dns instructions`
4. `deploy: add update.sh pull-and-restart script`
5. `deploy: add pg_dump backup script with rotation`
6. `deploy: add operator runbook`

---

## Acceptance criteria

- [ ] On a fresh Pi (or a clean VM matching Pi OS), running `REPO_URL=... ./scripts/install-pi.sh` completes without error
- [ ] `install-pi.sh` **refuses to proceed** if either logo is missing from `static/brand/` (fail-loud)
- [ ] `systemctl status p3-judging` shows `active (running)`
- [ ] `curl http://localhost:3000` from the Pi returns the SvelteKit app
- [ ] `cloudflared tunnel info p3-judging` reports the tunnel healthy
- [ ] Public URL `https://judging.<domain>.com` loads the app from outside the network
- [ ] `./scripts/update.sh` completes with no manual intervention after a `git push` to main
- [ ] `./scripts/backup-supabase.sh` produces a valid `.dump` file; restoring it into a fresh Postgres recreates the state

## Out of scope

- ❌ Don't write app code here (that's Tracks 1–5).
- ❌ Don't configure DNS automatically — Mohammad does that step in the Cloudflare UI once.
- ❌ Don't bake secrets into the repo. `.env` lives only on the Pi.

## Gotchas

- **Cloudflare Tunnel auth** is interactive once (`cloudflared tunnel login` opens a browser). Pi might be headless — run this step from a desktop with the Pi's `~/.cloudflared/` symlinked, OR use the certificate-token flow.
- **Node 20 ARM64 builds** from NodeSource work on Pi 4/5; do NOT install via `apt install nodejs` (Debian ships an outdated version).
- **`better-sqlite3`-style native modules:** we don't use them (we're on Supabase Postgres) — but if Track 1/3 ever pulls one in, rebuild for ARM with `pnpm rebuild`.
- **systemd `EnvironmentFile`** does NOT support `${VAR}` interpolation — write literal values in `.env`.
- **Cloudflare Access** adds a second auth layer on top of Supabase Auth. If used, the user clicks an email-login link from Cloudflare BEFORE they ever see Supabase's login. Document this clearly so judges don't get confused.
- **Backup cron** should NOT run before event day or storage fills up needlessly. Document enabling/disabling.
