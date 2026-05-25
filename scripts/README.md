# Operator runbook — Raspberry Pi deployment

One-page reference for installing, updating, backing up, and troubleshooting the
P3 Judging website on the Raspberry Pi. Full design rationale lives in
[`../tracks/TRACK_7_DEPLOY.md`](../tracks/TRACK_7_DEPLOY.md) and
[`../DEVELOPMENT.md`](../DEVELOPMENT.md) § 8.

All commands assume you are SSH'd into the Pi as a user with `sudo`. The app
itself runs as the unprivileged `p3judge` system user under systemd.

---

## 1. First install (fresh Pi)

```bash
# On the Pi — Raspberry Pi OS 64-bit, Bookworm or later.
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<you>/judging-site.git /tmp/judging-site-bootstrap

REPO_URL="https://github.com/<you>/judging-site.git" \
  bash /tmp/judging-site-bootstrap/scripts/install-pi.sh
```

The installer:

1. Installs Node 20 (from NodeSource, not Debian apt — Debian's version is too old).
2. Installs pnpm, `cloudflared`, and `postgresql-client`.
3. Creates the `p3judge` service user.
4. Clones the repo to `/opt/p3-judging` (override with `APP_DIR=...`).
5. **Refuses to continue** if `static/brand/p3-logo.{svg,png}` or
   `static/brand/bskl-logo.{svg,png}` is missing or zero bytes.
6. Runs `pnpm install --frozen-lockfile && pnpm build`.
7. Installs and enables (but does not start) the `p3-judging.service` systemd unit.

After the installer finishes, follow the printed **Next steps**:

1. Create `/opt/p3-judging/.env` (copy from `.env.example` and fill in Supabase
   keys and `DATABASE_URL`). Then:
   ```bash
   sudo chown p3judge:p3judge /opt/p3-judging/.env
   sudo chmod 600 /opt/p3-judging/.env
   ```
   systemd's `EnvironmentFile` does **not** expand `${VAR}` references — write
   literal values.
2. `cloudflared tunnel login` (opens a browser; headless? run this on a
   desktop and copy `~/.cloudflared/cert.pem` to the Pi).
3. `cloudflared tunnel create p3-judging` — note the UUID.
4. `sudo cp cloudflared/config.example.yml /etc/cloudflared/config.yml`,
   then edit the UUID + hostname placeholders.
5. Add a CNAME `judging → <UUID>.cfargotunnel.com` (proxied) in the Cloudflare
   DNS dashboard, or run
   `cloudflared tunnel route dns p3-judging judging.<your-domain>.com`.
6. Start everything:
   ```bash
   sudo cloudflared service install
   sudo systemctl start p3-judging cloudflared
   ```
7. Smoke-check from the Pi: `curl -fsS http://127.0.0.1:3000 | head -n 5`.
8. Smoke-check from outside: open `https://judging.<your-domain>.com`.

---

## 2. Update flow (after a `git push` to main)

```bash
sudo /opt/p3-judging/scripts/update.sh
```

This pulls, installs deps, builds, restarts the systemd unit, and prints status.
Restart is sub-second; no judge mid-scoring will notice a brief reconnect.

If the build fails, the previous `build/` directory is left in place — the
running service keeps serving the old version. Investigate the build error
before restarting.

---

## 3. Backups (event-day database snapshots)

### One-off

```bash
# Source the env so DATABASE_URL is in scope.
set -a; source /opt/p3-judging/.env; set +a
sudo -E /opt/p3-judging/scripts/backup-supabase.sh
```

Output: `${BACKUP_DIR:-/media/usb/p3-backups}/p3-judging-<timestamp>.dump`
(Postgres custom format). The script keeps the most recent 24 files and deletes
older ones (override with `KEEP=N`).

### Cron — enable on event-day morning, disable that evening

```bash
# Enable: every 5 minutes
sudo crontab -e
# Add:
*/5 * * * * . /opt/p3-judging/.env && /opt/p3-judging/scripts/backup-supabase.sh >> /var/log/p3-backup.log 2>&1

# Disable after the event:
sudo crontab -e   # delete the line
```

**Don't leave the cron enabled long-term** — the USB drive will fill up and the
script will start failing.

### Pre-checks before relying on backups

```bash
# Confirm USB is mounted and writable:
mountpoint /media/usb && touch /media/usb/p3-backups/.write-test && rm /media/usb/p3-backups/.write-test
# Confirm pg_dump can reach Supabase:
set -a; source /opt/p3-judging/.env; set +a
pg_isready -d "$DATABASE_URL"
```

---

## 4. Restore from a dump

```bash
# Into the same Supabase project (DESTRUCTIVE — wipes existing tables first):
set -a; source /opt/p3-judging/.env; set +a
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$DATABASE_URL" \
  /media/usb/p3-backups/p3-judging-<timestamp>.dump

# Into a fresh local Postgres (recommended for dry-run testing):
createdb p3_judging_restore
pg_restore --no-owner --no-privileges \
  -d postgres://postgres@localhost/p3_judging_restore \
  /media/usb/p3-backups/p3-judging-<timestamp>.dump
```

After a destructive restore, restart the app so any cached state is dropped:
`sudo systemctl restart p3-judging`.

---

## 5. Logs

```bash
# Follow app logs in real time:
sudo journalctl -u p3-judging -f

# Last 200 lines:
sudo journalctl -u p3-judging -n 200 --no-pager

# Since boot:
sudo journalctl -u p3-judging -b

# Cloudflare tunnel logs:
sudo journalctl -u cloudflared -f
```

---

## 6. Tunnel status

```bash
# Healthy tunnel + connector count:
cloudflared tunnel info p3-judging

# List all tunnels on this account:
cloudflared tunnel list

# Validate config syntax without starting:
sudo cloudflared --config /etc/cloudflared/config.yml ingress validate

# Test what hostname routes to what service:
sudo cloudflared --config /etc/cloudflared/config.yml ingress rule https://judging.<your-domain>.com
```

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `systemctl status p3-judging` → `failed`, journal shows `Cannot find module 'build/index.js'` | Build never ran or failed silently. Re-run `sudo /opt/p3-judging/scripts/update.sh` and read the build output. |
| `502 Bad Gateway` from the public URL | App isn't listening on `127.0.0.1:3000`. Check `sudo journalctl -u p3-judging -n 50` and `ss -tlnp | grep 3000`. |
| `503 Origin Unreachable` from Cloudflare | Tunnel is up but app is down, or tunnel is down. Check both `systemctl status p3-judging` and `systemctl status cloudflared`. |
| App starts then exits after 1s | Almost always a missing env var. `cat /opt/p3-judging/.env`, confirm no quotes around values (systemd doesn't strip them), confirm no `${VAR}` interpolation attempts. |
| `install-pi.sh` exits with `FATAL: P3 logo missing or empty` | A logo file in `static/brand/` is missing or zero bytes. Replace it before re-running. The installer refuses to deploy without both logos. |
| `pnpm install` fails with `EACCES` on the Pi | The clone is owned by the wrong user. Fix: `sudo chown -R p3judge:p3judge /opt/p3-judging`. |
| `cloudflared` errors on startup: `tunnel credentials file not found` | The `<UUID>.json` credentials file isn't at the path in `config.yml`. Copy it from `~/.cloudflared/<UUID>.json` to `/etc/cloudflared/`. |
| Judges land on a Cloudflare email-OTP page they didn't expect | Cloudflare Access is enabled. Either remove the Access policy, or document the double-login flow in their onboarding email. |
| `backup-supabase.sh` exits `FATAL: BACKUP_DIR ... is not writable` | The USB drive isn't mounted, or it's mounted read-only. `mount | grep media/usb` and remount. |
| A `pnpm rebuild` is needed after pulling a track that adds a native module | Run `sudo -u p3judge pnpm rebuild` inside `/opt/p3-judging` before restarting the service. |

---

## 8. Useful one-liners

```bash
# App health from the Pi itself:
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000

# Public health (replace domain):
curl -sS -o /dev/null -w '%{http_code}\n' https://judging.<your-domain>.com

# Disk used by backups:
du -sh /media/usb/p3-backups

# Restart everything (rare — only after Pi OS updates):
sudo systemctl restart p3-judging cloudflared
```
