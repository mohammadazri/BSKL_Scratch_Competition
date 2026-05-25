import { defineConfig } from '@playwright/test';

// Track 6 — Playwright config.
// Tests live in `e2e/` as `*.spec.ts`. The legacy `*.e2e.{ts,js}` glob is kept
// for any in-tree component-level e2e tests (Track 0 may have planted some).
// Auth setup runs first via the `setup` project; everything else inherits
// stored auth state from `e2e/.auth/*.json`.
//
// Required environment (in `.env.test`, NOT `.env`):
//   PLAYWRIGHT_BASE_URL=http://localhost:4173
//   PLAYWRIGHT_SUPER_ADMIN_EMAIL / _PASSWORD
//   PLAYWRIGHT_JUDGE_EMAIL / _PASSWORD
//   PLAYWRIGHT_JUDGE2_EMAIL / _PASSWORD       (for cross-judge RLS test)
//   PLAYWRIGHT_VIEWER_EMAIL / _PASSWORD
//   PUBLIC_SUPABASE_URL (staging)
//   SUPABASE_SERVICE_ROLE_KEY (staging — for the RLS-isolation harness only)
//
// See `e2e/README.md` for setup details.

// Load `.env.test` if it exists; fall back to `.env` so a developer with
// only one .env file can still run the suite locally.
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
dotenv.config({ path: existsSync('.env.test') ? '.env.test' : '.env' });

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	testMatch: ['**/*.spec.ts', '**/*.e2e.{ts,js}'],
	fullyParallel: false, // dry-run state shared across specs; keep deterministic
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	timeout: 30_000,
	expect: { timeout: 7_500 },
	use: {
		baseURL: BASE_URL,
		actionTimeout: 7_500,
		navigationTimeout: 15_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: process.env.PLAYWRIGHT_WEB_SERVER_CMD ?? 'pnpm run build && pnpm run preview',
		port: PORT,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
