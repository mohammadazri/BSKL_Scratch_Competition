# Design System — P3 Judging

**Shared reference.** Every UI track (2, 3, 4, 5, 6) builds against this. If the design needs to evolve, update this file first, then components.

**Direction:** Premium Dark Tech. Professional, modern, futuristic — matches the brief for a corporate event. Dark-first because the venue projector and judging tablets read better in low-light, and dark surfaces convey "precision instrument" rather than "kids' toy." A light-mode toggle is supported for daylight use.

---

## 1. Brand context

Two organisations sit on the header of every page:

- **P3 Robotics & Coding** — competition host. Website: https://www.p3platform.com/. Brand colour is **magenta / hot pink** (visible in the P3 logo used in the rubric PDFs). This is our `--accent` token.
- **BSKL — British International School of Kuala Lumpur** — venue & co-host. Website: https://www.britishschool.edu.my/.

### Logo handling

Track 0 fetches both logos and stores them in `static/brand/`:

```
static/brand/
├── p3-logo.svg          ← fetched from p3platform.com (look in <link rel="icon"> and homepage <img>)
├── p3-logo.png          ← raster fallback
├── bskl-logo.svg        ← fetched from britishschool.edu.my
└── bskl-logo.png        ← raster fallback
```

Rules for logo use:
- Always use the **official asset** — never redraw, recreate, restyle, or recolour the logos.
- Header layout: `[P3 logo]  P3 JUDGING  ·  Future Coders Challenge 2026  ·  hosted at [BSKL logo]`
- Logos display at fixed pixel height (32px desktop, 28px mobile) — width auto.
- If a logo asset is missing at build time, the build fails (don't ship broken branding). Track 0's `install-pi.sh` verifies the files exist before allowing deploy.

---

## 2. Design tokens

Implement in `src/app.css` via Tailwind `@theme` directive (Tailwind v4) or `tailwind.config.ts` `theme.extend` (v3).

### Colours

| Token | Dark mode | Light mode | Use |
|---|---|---|---|
| `--bg-0` | `#0A0F1C` | `#FAFAFA` | App background |
| `--bg-1` | `#111827` | `#FFFFFF` | Default surface |
| `--bg-2` | `#1F2937` | `#F3F4F6` | Raised surface, cards |
| `--bg-3` | `#374151` | `#E5E7EB` | Hover state, inputs |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Hairline dividers |
| `--border-strong` | `rgba(255,255,255,0.16)` | `rgba(0,0,0,0.16)` | Card outline, focus |
| `--text-1` | `#F8FAFC` | `#0F172A` | Primary text |
| `--text-2` | `#94A3B8` | `#475569` | Secondary text, labels |
| `--text-3` | `#64748B` | `#94A3B8` | Disabled / placeholder |
| `--accent` | `#EC4899` | `#DB2777` | P3 magenta — primary actions, brand |
| `--accent-soft` | `rgba(236,72,153,0.12)` | `rgba(219,39,119,0.10)` | Accent backgrounds |
| `--accent-2` | `#38BDF8` | `#0284C7` | Electric cyan — info, links |
| `--success` | `#10B981` | `#059669` | Submitted, OK |
| `--warning` | `#F59E0B` | `#D97706` | Draft, attention |
| `--danger` | `#EF4444` | `#DC2626` | DQ, error, override |

**Rule:** never combine `--accent` with `--accent-2` on the same primary action. Pick one per surface.

### Typography

| Use | Font | Weight | Size |
|---|---|---|---|
| Display (rare, hero) | Space Grotesk | 700 | 48–64px |
| Heading 1 (page) | Space Grotesk | 600 | 28px |
| Heading 2 (section) | Space Grotesk | 600 | 20px |
| Heading 3 (card) | Space Grotesk | 500 | 16px |
| Body | Inter | 400 | 14px (15px on tablets) |
| Body-strong | Inter | 600 | 14px |
| Label | Inter | 500 | 12px (uppercase, letter-spacing 0.05em) |
| Numbers / scores / time | JetBrains Mono | 500 | matches surrounding text size +1 |
| Code / IDs | JetBrains Mono | 400 | 13px |

Self-host via `@fontsource/inter`, `@fontsource/space-grotesk`, `@fontsource/jetbrains-mono` — **do not load from Google Fonts CDN** (BSKL WiFi might be fine, but self-hosting removes the dependency and keeps the app fully tunneled through Cloudflare).

### Spacing

4px base unit. Tailwind defaults work. Section spacing 32–48px. **Minimum touch target 44 × 44px** on every interactive element — non-negotiable for tablet judges.

### Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | Inputs, small chips |
| `--radius` | 8px | Buttons, cards |
| `--radius-lg` | 12px | Modals, big surfaces |

No fully-rounded "pill" buttons except for status badges. Squarer = more corporate.

### Elevation

Avoid heavy shadows in dark mode (they don't show up on dark anyway). Use **borders** instead of shadows to lift surfaces. Light mode uses subtle `0 1px 2px rgba(0,0,0,0.05)`.

### Motion

- All transitions: `150ms ease-out` default, `250ms ease-out` for layout changes.
- **No bouncy, no spring, no rainbow gradients in motion.** This is corporate, not playful.
- Toast notifications slide in from top-right, 4s auto-dismiss.
- Score totals tick up with a 200ms count-up when they change (subtle reward).

### Iconography

- **Lucide** (https://lucide.dev), 1.5px stroke, 16px or 20px sizes only.
- Never mix icon libraries.
- Status icons:
  - Draft: `circle-dashed` (warning colour)
  - Submitted: `check-circle-2` (success)
  - Finalised: `lock` (text-2)
  - Override: `shield-alert` (danger)
  - DQ: `ban` (danger)

---

## 3. Layout patterns

### Global shell

Every authenticated page sits inside `<AppShell>`:

```
┌─────────────────────────────────────────────────────────────┐
│  [P3] P3 JUDGING       Future Coders 2026     [BSKL] User▾ │  ← top bar 56px
├──────┬──────────────────────────────────────────────────────┤
│      │  ‹ breadcrumb                                         │
│ Nav  │                                                       │
│ 240px│  <page content>                                       │
│      │                                                       │
│      │                                                       │
└──────┴──────────────────────────────────────────────────────┘
```

- **Top bar (56px):** brand cluster left, breadcrumb hidden on mobile, user menu (avatar initials + role pill) right.
- **Sidebar nav (240px desktop, hidden on mobile):** icon + label. Active item: 2px left accent bar + `--accent-soft` background. Collapsible to 56px icon-only.
- **Mobile (<768px):** sidebar becomes bottom drawer triggered by hamburger.
- **Tablet (768–1024px):** sidebar is icon-only by default, expands on hover/tap.

### Page header

Every page starts with:

```
‹ Breadcrumb / Path
─────────────────────────
Page Title                              [Primary action]
Optional subtitle / description
─────────────────────────────────────────────────────────
```

- H1 + optional secondary actions on same row.
- Always show the page title — don't rely on the URL.

### Cards

```
┌──────────────────────────────────────┐
│ SECTION LABEL              optional» │  ← 12px uppercase label
│                                       │
│  Card content                         │
│                                       │
└──────────────────────────────────────┘
```

- Background: `--bg-2`, border: `--border`, radius `--radius`.
- Padding: 24px (16px on mobile).
- Section label uses `--text-2`, uppercase, letter-spacing.

### Forms

- Inputs: `--bg-3` background, `--border` outline, focus ring `2px --accent`.
- Labels above inputs, not floating.
- Required marker: small `--accent` dot after label.
- Error messages below input in `--danger`, with `circle-alert` icon.
- Submit buttons: bottom-right of form card.

### Tables

- Header row: `--bg-3` background, `--text-2`, uppercase 12px.
- Body rows: alternating tint via `bg-bg-1` / `bg-bg-2`.
- Hover: `--accent-soft` row tint.
- Sticky header on scroll.
- Right-aligned numeric columns, mono font.

### Status pills

```
● submitted    ◐ draft    ⚐ finalised    ⚠ override
```

- 22px height, 8px padding-x, full radius (pills are OK here).
- Coloured 8px dot + text. Background `--bg-3`. Text `--text-1`.
- Outline variant for "tentative" states.

---

## 4. Key screen patterns

### A. Judge scoring form (`/judge/score/[id]`) — the main UX

**Goal:** judge scores one student in under 5 minutes without leaving the page.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ My queue                                                        │
├──────────────────────────────────────────────────────────────────┤
│  Aisha Tan · BSKL                                                 │
│  CATEGORY B · Eco-Warriors · Sheet #atb-29f                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
├────────────────────────────────────────┬─────────────────────────┤
│  ▌SECTION A  Phase 1 At-Home Build    │   ▎LIVE TOTAL           │
│                                        │   ╔═════════════════╗   │
│  THEME & VISUAL DESIGN          /16   │   ║  84 / 100       ║   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   ╚═════════════════╝   │
│  ● Excellent   14–16                   │   ▓▓▓▓▓▓▓▓▓░░░░  84%   │
│  ○ Proficient  10–13                   │                         │
│  ○ Developing   4–9                    │   PROGRESS              │
│  ○ Insufficient 0–3                    │   ▓▓▓▓▓▓▓░░░  7 of 10  │
│  Points  ⟨ 15 ⟩   ✎ optional note      │                         │
│                                        │   ⏱  SPRINT TIME        │
│  VARIABLES & GAMEPLAY           /22   │   ╔═════════════╗       │
│  (collapsed — click to expand)         │   ║  41 : 27    ║       │
│                                        │   ╚═════════════╝       │
│  ▌SECTION B  Live Sprint Mystery      │                         │
│  ...                                   │   ◐ saved 3s ago        │
│                                        │   ⚠ Raise DQ flag       │
│                                        │   ─────────────────     │
│                                        │   [ Save & exit ]       │
│                                        │   [ SUBMIT FINAL ▸ ]   │
└────────────────────────────────────────┴─────────────────────────┘
```

- **Left column (60%):** scrollable list of criteria, accordion-collapsible by section.
- **Right column (40%) sticky:** live total, progress, sprint timer entry, DQ flag, submit. Always visible while scrolling.
- **Criterion card:** name + max points label on top right, 4 radio levels (band shown on each), then a stepper number input clamped to chosen band.
- **Picking a level auto-fills the points** with the middle of the band, judge can adjust ±. Changing points outside the band re-selects the level.
- **Comment ✎:** collapsed by default, click to expand.
- **Autosave** every 10s and on any blur. Status indicator shows "saving…" / "saved Ns ago" / "save failed — retrying".
- **Submit button** is disabled until all criteria scored AND `live_sprint_time_seconds` entered (or DQ flag raised).
- **Confirmation modal** before submit: "Once submitted, you can't edit. Super_admin can unlock if needed."

### B. Super admin dashboard (`/admin`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Dashboard                                          14h to event │
├──────────────────────────────────────────────────────────────────┤
│  ▎EVENT PROGRESS                                                  │
│                                                                   │
│   Cat A  ████████████░░░░░░  36 / 45  scored                     │
│   Cat B  ███████░░░░░░░░░░░  21 / 45  scored                     │
│   Cat C  ██░░░░░░░░░░░░░░░░   6 / 45  scored                     │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  ▎JUDGE LOAD                          ▎RECENT ACTIVITY  ◐ live   │
│                                                                   │
│   Sarah    ●●●●●●●●○○○  8 / 11        14:32  Sarah   submit  →   │
│   Ravi     ●●●●●○○○○○○  5 / 11        14:31  Ravi    start   →   │
│   Mei Lin  ●●●●●●●●●○○  9 / 11        14:28  System  assign  →   │
│   Kumar    ●●●●○○○○○○○  4 / 11        14:25  You     override⚠  │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  [ Auto-assign ▸ ]  [ Lock event ]  [ Export CSV ]  [ Audit log ]│
└──────────────────────────────────────────────────────────────────┘
```

### C. Leaderboard (`/admin/results` and `/viewer/results`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Leaderboard       Cat B ▾   Eco-Warriors ▾    Export CSV       │
├──────────────────────────────────────────────────────────────────┤
│  RANK  PARTICIPANT          SCHOOL    SCORE     TIME    STATUS  │
│  ━━━━  ━━━━━━━━━━━           ━━━━━━    ━━━━━     ━━━━    ━━━━━━ │
│   1 ★   Aisha Tan            BSKL     94/100   03:42   ● final │
│   2     Ravi Singh           ISKL     91/100   03:58   ● final │
│   2 ⓘ   Mei Lin Wu           MKIS     91/100   04:12  tied     │
│   4     Tom O'Brien          Garden   88/100   04:01   ● final │
│   5     Liam Chen            Alice    86/100   04:33   ○ draft │
│  ...                                                              │
│                                                                   │
│  ⓘ Ties auto-broken by sprint time (faster wins).                │
└──────────────────────────────────────────────────────────────────┘
```

- Top 3 get medal indicators (★ gold, ☆ silver, ☆ bronze in `--accent` / `--text-2` / brown).
- Ties show `ⓘ tied` next to rank.
- Click row → drill into per-criterion breakdown.

### D. Audit log (`/admin/audit`, `/viewer/audit`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Audit log                              ◐ live    Export CSV ▸   │
├──────────────────────────────────────────────────────────────────┤
│  Actor ▾   Action ▾   Target ▾   Date range ▾        Search 🔍  │
├──────────────────────────────────────────────────────────────────┤
│  TIME      ACTOR     ACTION              TARGET              ⓘ  │
│  ──────    ──────    ──────              ──────              ── │
│  14:32:08  Sarah     scoresheet_submit   Aisha Tan          ›   │
│  14:28:55  System    assignment_auto_run Cat C — 45 moves   ›   │
│  14:25:13  You ⚠     score_override      Mei Wu / Theme     ›   │
│  14:18:02  Ravi      scoresheet_create   Tom Lee            ›   │
│  ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

- Each row expands to show full before/after JSON diff.
- Override rows highlighted with subtle `--accent-soft` background.

---

## 5. Component catalogue (build in `src/lib/components/`)

| Component | Props (sketch) | Used in |
|---|---|---|
| `<AppShell>` | `children`, `user` | every authenticated page |
| `<Sidebar>` | `items[]`, `activeHref` | AppShell |
| `<PageHeader>` | `title`, `subtitle`, `actions` | every page |
| `<Card>` | `label?`, `children` | most pages |
| `<Button>` | `variant: primary|secondary|ghost|danger`, `loading`, `icon` | everywhere |
| `<Input>` `<Select>` `<Textarea>` | standard | forms |
| `<NumberStepper>` | `min`, `max`, `value`, `onChange` | scoring form |
| `<TimeInput>` | `value: seconds`, `max: 2700` | scoring form sprint time |
| `<RadioLevel>` | `levels: {label, range, descriptor}[]`, `selected` | scoring form |
| `<StatusPill>` | `status: draft|submitted|finalised|override|dq` | many |
| `<DataTable>` | `columns`, `rows`, `sortable`, `sticky` | results, audit, lists |
| `<ProgressBar>` | `value`, `max`, `colour` | dashboard, scoring |
| `<Toast>` | global service | save indicators, errors |
| `<ConfirmModal>` | `title`, `message`, `confirmLabel`, `danger?` | submit, delete, override |
| `<BrandHeader>` | renders P3 + BSKL logos | AppShell top bar |
| `<EmptyState>` | `icon`, `title`, `description`, `action?` | empty queues, no data |

---

## 6. Accessibility

- Contrast: every text/background pair clears WCAG AA (4.5:1). Verify before merging UI.
- All interactive elements reachable by keyboard (Tab order, visible focus ring).
- Focus ring: `2px solid --accent`, offset 2px from element.
- Form inputs have `<label>` (never placeholder-as-label).
- Status icons always paired with text ("● submitted" not just `●`).
- Reduced motion: respect `prefers-reduced-motion`, kill count-up animation.

---

## 7. What NOT to do

- ❌ No gradients on backgrounds, buttons, or cards. (One exception: the empty-state illustration may have a subtle radial accent glow.)
- ❌ No glassmorphism / blur-behind-card. Reads as 2021-trendy, not "modern timeless."
- ❌ No emoji in UI labels or buttons. (Icons yes, emoji no.)
- ❌ No drop shadows in dark mode.
- ❌ No more than two brand colours on a screen at once (P3 magenta + cyan — pick one as the dominant).
- ❌ No "Powered by [anything]" footers. The footer is plain: event name + copyright.
- ❌ No animated GIFs, no Lottie, no autoplaying anything.

---

## 8. Reference inspirations (mood, not copy)

Look at: **Linear** (typography + density), **Vercel dashboard** (dark palette + restraint), **Stripe Sigma** (data-density done right), **GitHub** (sidebar + table patterns). Avoid copying any of them — synthesise.
