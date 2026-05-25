# Track 0 — Project scaffolding

**Goal:** create a working SvelteKit app with Tailwind, Supabase client, Drizzle, fonts, brand assets, and the design token system from [DESIGN.md](../DESIGN.md). No business logic yet — just a shell that other tracks build inside.

**This track BLOCKS all others.** Finish and merge to `main` before tracks 1–7 start.

**Branch:** commit directly to `main` (you're alone here).

**Inputs to read first:**
- [../DEVELOPMENT.md](../DEVELOPMENT.md) — hard rules, commit policy
- [../DESIGN.md](../DESIGN.md) — design tokens (you implement them here)
- [../SCHEMA.md](../SCHEMA.md) — just skim, so you know what's coming

---

## Step 1 — Initialise

```bash
cd c:/Users/moham/Temp_Code/Competition/judging-site
git init
git add DEVELOPMENT.md SCHEMA.md SEED_RUBRICS.md DESIGN.md tracks/
git commit -m "initial planning docs for p3 judging website"

pnpm create svelte@latest .
# Pick: Skeleton project, TypeScript, ESLint, Prettier, Playwright, Vitest
pnpm install
git add -A
git commit -m "scaffold sveltekit with typescript, eslint, prettier, playwright, vitest"
```

## Step 2 — Tailwind v4 + design tokens

```bash
pnpm add -D tailwindcss @tailwindcss/vite
pnpm add @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono
pnpm add lucide-svelte
```

`vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

`src/app.css` — implement every token from `DESIGN.md` § 2 exactly. Use Tailwind v4 `@theme` directive:

```css
@import 'tailwindcss';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/space-grotesk/700.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';

@theme {
  --color-bg-0: #0A0F1C;
  --color-bg-1: #111827;
  --color-bg-2: #1F2937;
  --color-bg-3: #374151;
  --color-text-1: #F8FAFC;
  --color-text-2: #94A3B8;
  --color-text-3: #64748B;
  --color-accent: #EC4899;
  --color-accent-2: #38BDF8;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;
}

html, body { background: var(--color-bg-0); color: var(--color-text-1); font-family: var(--font-sans); }

@media (prefers-color-scheme: light) {
  @theme {
    --color-bg-0: #FAFAFA;
    --color-bg-1: #FFFFFF;
    --color-bg-2: #F3F4F6;
    --color-bg-3: #E5E7EB;
    --color-text-1: #0F172A;
    --color-text-2: #475569;
    --color-text-3: #94A3B8;
    /* ...etc */
  }
}
```

Add `src/app.css` import to `src/routes/+layout.svelte`.

```bash
git add -A
git commit -m "wire tailwind v4 with design tokens, self-hosted fonts, lucide icons"
```

## Step 3 — Supabase + Drizzle wiring

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

`src/lib/server/supabase.ts` — server-side supabase admin client (service role key):

```ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
```

`src/lib/supabase.ts` — client-side anon client (for browser):

```ts
import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
```

`src/hooks.server.ts` — attach `event.locals.supabase` and `event.locals.user` per request.

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! }
});
```

Create empty `src/lib/server/db/schema.ts` — Track 1 fills it.

```bash
git add -A
git commit -m "wire supabase clients (server admin, browser anon) and drizzle config"
```

## Step 4 — `.env.example`

```
# Supabase — get from https://supabase.com/dashboard → your project → Settings → API
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...

# Direct Postgres URL for Drizzle migrations (Supabase → Settings → Database → Connection string)
DATABASE_URL=postgresql://postgres:[password]@db.<project-ref>.supabase.co:5432/postgres

# Optional — only if using Cloudflare Access on top of Supabase Auth
CF_ACCESS_AUD=
CF_ACCESS_TEAM_DOMAIN=
```

Add `.env` to `.gitignore` (should already be there from SvelteKit scaffold).

```bash
git add .env.example .gitignore
git commit -m "document env vars in .env.example"
```

## Step 5 — File structure

Create empty directories with `.gitkeep` so other tracks have known locations:

```
src/
├── lib/
│   ├── components/      (Track 2/3/4/5)
│   ├── server/
│   │   ├── db/          (Track 1: schema.ts)
│   │   └── supabase.ts  (done in step 3)
│   ├── supabase.ts      (done in step 3)
│   ├── types.ts         (shared TS types — Track 1 starts, others extend)
│   └── utils/           (small helpers)
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte                          (redirect to /login or role-home)
│   ├── login/                                (public)
│   ├── (app)/+layout.svelte                  (authenticated shell)
│   ├── (app)/judge/                          (Track 3)
│   ├── (app)/admin/                          (Track 2, 4, 5)
│   └── (app)/viewer/                         (Track 4, 5)
├── app.css                                   (done in step 2)
├── app.html
└── hooks.server.ts                           (done in step 3)
supabase/
├── migrations/          (Track 1)
└── seed/                (Track 1)
scripts/                 (Track 7)
e2e/                     (Track 6)
static/
├── brand/               (this step — logos)
└── favicon.png
```

```bash
git add -A
git commit -m "establish src/, supabase/, scripts/, e2e/, static/brand/ directory layout"
```

## Step 6 — Fetch brand logos

P3 Robotics & Coding logo (homepage at https://www.p3platform.com/):

```bash
# Inspect the page first to find the actual logo asset URL — open in browser, view source, look
# for <link rel="icon"> and any <img> in the header. Save to static/brand/.
# Examples (verify the actual URLs by visiting the site):
curl -L -o static/brand/p3-logo.png 'https://www.p3platform.com/<actual-logo-path>.png'
# Or if SVG is available, prefer SVG.
```

BSKL logo (https://www.britishschool.edu.my/):

```bash
curl -L -o static/brand/bskl-logo.png 'https://www.britishschool.edu.my/<actual-logo-path>.png'
```

**Verify both files exist and aren't empty before committing.** Open them in a viewer to confirm they're not error pages saved as `.png`.

```bash
git add static/brand/
git commit -m "add p3 and bskl official logos for app header branding"
```

If the logos aren't readily fetchable via curl (some sites use auth/CDN), download manually via browser and drop into `static/brand/`. Either way, the files must exist in the repo before any UI track ships.

## Step 7 — Brand header component

`src/lib/components/BrandHeader.svelte` — renders the two logos + app title per DESIGN.md § 1. Build per the pattern there. Use plain `<img>` tags with `alt="P3 Robotics & Coding"` and `alt="British International School of Kuala Lumpur"`. Logos at 32px height desktop, 28px mobile.

```bash
git add src/lib/components/BrandHeader.svelte
git commit -m "add brand header component with p3 and bskl logos"
```

## Step 8 — Spell-check config (kill the BSKL warning noise)

`cspell.json`:

```json
{
  "version": "0.2",
  "language": "en",
  "words": [
    "BSKL", "Aisha", "Azri", "cloudflared", "drizzle", "ISKL", "MKIS",
    "P3", "Scratch", "sb3", "supabase", "sveltekit", "tailwindcss",
    "Lucia", "puppeteer", "tabler"
  ],
  "ignorePaths": ["node_modules", "build", ".svelte-kit", "static/brand"]
}
```

```bash
git add cspell.json
git commit -m "add cspell config with project terms allowlist"
```

## Step 9 — Skeleton routes (so dev server boots)

Create placeholder pages so `pnpm dev` shows something at every route. Each is a one-line "Track N coming soon" — other tracks replace them.

```bash
git add -A
git commit -m "add placeholder pages for /login /judge /admin /viewer routes"
```

## Step 10 — Verify

```bash
pnpm dev
# Open http://localhost:5173 — should see:
# - dark background
# - brand header with both logos
# - Inter font loaded
# - no console errors
pnpm check    # svelte-check passes
pnpm lint     # eslint passes
pnpm build    # production build succeeds
```

```bash
git commit --allow-empty -m "track 0 scaffold complete — ready for tracks 1-7"
git tag v0.0.0-scaffold
```

---

## Acceptance criteria

- [ ] `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm lint` all succeed clean
- [ ] App boots at `http://localhost:5173` showing dark background + brand header
- [ ] Both logos load from `static/brand/` and display in header
- [ ] All three font families render correctly (verify in DevTools)
- [ ] `.env.example` documents every required variable
- [ ] `.env` is gitignored
- [ ] Directory structure matches Step 5
- [ ] cspell warnings are clean
- [ ] Every commit message is plain — no AI attribution

## Out of scope (don't do these here)

- ❌ Don't write any DB schema (Track 1 owns this).
- ❌ Don't build the scoring form, admin pages, or any business logic.
- ❌ Don't set up authentication flow (Track 2 owns the login UI; Supabase Auth is wired but unused).
- ❌ Don't write Pi deploy scripts (Track 7 owns this).

## Gotchas

- **Tailwind v4** uses CSS-first config via `@theme` — not `tailwind.config.ts`. Don't mix v3 patterns.
- `@fontsource/*` packages must be **imported in CSS**, not in JS, for SvelteKit to bundle them correctly.
- **Service role key vs anon key:** service role goes only in `$env/static/private` (server-only); anon key in `$env/static/public`. Mixing these up leaks superuser access.
- **Logo files:** if the host site uses Cloudflare Image Resizing or auth-walled assets, `curl` may return HTML. Always verify the downloaded file with `file static/brand/p3-logo.png` — it should report `PNG image data`, not `HTML document`.
