# TODO — Replace placeholder brand assets

`static/brand/p3-logo.svg` and `static/brand/bskl-logo.svg` are **placeholders**, not the real brand assets.

The Track 0 setup script tried to fetch the official logos from:

- https://www.p3platform.com/ (Google Sites, hotlinking returns HTTP 403)
- https://www.britishschool.edu.my/ (308 redirect chain — Cloudflare blocks scripted access)

Neither could be auto-downloaded. The placeholders render as text-only SVGs so the BrandHeader component works visually and `pnpm build` / Track 7's deploy script don't fail on missing assets.

## Before the event — replace them

Drop the real assets into `static/brand/`, keeping these filenames:

```
static/brand/p3-logo.svg       ← preferred — vector, scales cleanly on tablet retinas
static/brand/p3-logo.png       ← optional raster fallback
static/brand/bskl-logo.svg     ← preferred
static/brand/bskl-logo.png     ← optional raster fallback
```

Sources:

- **P3 logo:** ask P3 Robotics & Coding marketing for the official SVG / high-res PNG. The placeholder uses brand magenta `#EC4899` from `DESIGN.md`.
- **BSKL logo:** request from BSKL communications, or download from a logged-in browser session at https://www.britishschool.edu.my/ (right-click the masthead logo → save).

## Verification after replacing

```powershell
pnpm dev
# Open http://localhost:5173 — header should show both real logos side-by-side
```

Track 7's `scripts/install-pi.sh` checks for file presence and size > 0 before allowing a deploy — so once you replace the placeholders, the production deploy picks them up automatically on the next `./scripts/update.sh`.

Once both real logos are in place and verified, **delete this file** and commit:

```
git rm TODO_BRAND_ASSETS.md
git add static/brand/
git commit -m "add official p3 and bskl brand logos"
```
