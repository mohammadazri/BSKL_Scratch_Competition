# Brand asset placeholders — REPLACE BEFORE PRODUCTION DEPLOY

The two SVGs in this directory (`p3-logo.svg`, `bskl-logo.svg`) are **typographic placeholders** — clean text wordmarks in the project's design-token colours. They are NOT the official P3 Robotics & Coding or BSKL logos.

## Why placeholders

Track 0 fetches the real logos automatically when run on a network that can reach the source sites. In this sandboxed setup that download wasn't run end-to-end — the placeholders keep the app building, branded-correctly, and visually consistent so UI tracks (2/3/4/5) aren't blocked.

## To replace with the real assets

1. **P3 Robotics & Coding logo**
   - Source: https://www.p3platform.com/
   - Inspect the homepage for the official logo asset (look in `<link rel="icon">`, the header `<img>`, and any `<svg>` inline). Prefer SVG. If only PNG is available, also fetch a higher-res PNG for retina.
   - Save as `static/brand/p3-logo.svg` (overwriting this placeholder) and optionally `static/brand/p3-logo.png`.

2. **BSKL logo**
   - Source: https://www.britishschool.edu.my/
   - Same approach — prefer SVG, fall back to a high-res PNG.
   - Save as `static/brand/bskl-logo.svg` (overwriting) and optionally `static/brand/bskl-logo.png`.

3. **Verify**
   - Reload `pnpm dev` at `http://localhost:5173` — header should show the real logos at 32px height.
   - Run `scripts/install-pi.sh` on the Pi (Track 7) — it refuses to deploy if either logo file is missing or empty.

## Rules

- Use **official assets only** — do not redraw, restyle, or recolour. The placeholders here are explicitly text wordmarks, not faux-logos, so they can't be mistaken for the real brand marks.
- File path is load-bearing: `static/brand/<name>-logo.{svg|png}` — `BrandHeader.svelte` references these paths directly.
