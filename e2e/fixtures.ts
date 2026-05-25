/**
 * e2e/fixtures.ts
 *
 * Tiny harness shared by every spec. We deliberately avoid Playwright's
 * built-in `storageState` for two reasons:
 *
 *   1. Supabase issues per-session JWTs that expire and refresh, so a stored
 *      state captured days ago will silently fail. Re-running the login flow
 *      per spec is cheap (one form submit) and self-healing.
 *   2. Some specs need to switch user mid-test (e.g. RLS isolation, judge
 *      handoff). A helper function is easier than juggling storage files.
 *
 * Reads creds from `process.env.PLAYWRIGHT_*` — see `e2e/README.md`.
 */

import { expect, type Page } from '@playwright/test';

export interface SeededAccount {
	email: string;
	password: string;
}

function readEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing env var ${name}. Copy .env.test.example -> .env.test.`);
	}
	return value;
}

export const accounts = {
	get superAdmin(): SeededAccount {
		return {
			email: readEnv('PLAYWRIGHT_SUPER_ADMIN_EMAIL'),
			password: readEnv('PLAYWRIGHT_SUPER_ADMIN_PASSWORD')
		};
	},
	get judge(): SeededAccount {
		return {
			email: readEnv('PLAYWRIGHT_JUDGE_EMAIL'),
			password: readEnv('PLAYWRIGHT_JUDGE_PASSWORD')
		};
	},
	get judge2(): SeededAccount {
		return {
			email: readEnv('PLAYWRIGHT_JUDGE2_EMAIL'),
			password: readEnv('PLAYWRIGHT_JUDGE2_PASSWORD')
		};
	},
	get viewer(): SeededAccount {
		return {
			email: readEnv('PLAYWRIGHT_VIEWER_EMAIL'),
			password: readEnv('PLAYWRIGHT_VIEWER_PASSWORD')
		};
	}
};

/** Land on /login (if not already), fill in credentials, wait for redirect. */
export async function signIn(page: Page, account: SeededAccount): Promise<void> {
	await page.goto('/login');
	await page.getByLabel(/email/i).fill(account.email);
	await page.getByLabel(/password/i).fill(account.password);
	await page.getByRole('button', { name: /sign in/i }).click();
	// Role-redirect lands at one of /admin, /judge, /viewer. Wait for any of
	// the three so this helper is role-agnostic.
	await page.waitForURL(/\/(admin|judge|viewer)(\/|$)/, { timeout: 15_000 });
}

export async function signOut(page: Page): Promise<void> {
	await page.goto('/logout');
	await page.waitForURL(/\/login/, { timeout: 10_000 });
}

/**
 * Wait for an autosave indicator to settle. The judge scoresheet uses
 * `<SaveStatusIndicator>` which transitions between "Saving…" and "Saved"
 * statuses — we poll for either the "Saved" text or its aria-live region.
 */
export async function expectAutosaveSaved(page: Page): Promise<void> {
	await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper for the leaderboard tiebreak test. Mohammad will configure two
 * scoresheets in staging (via seed-fake-event + a manual scoring pass) that
 * end up with identical totals but different sprint times.
 */
export function baseUrl(): string {
	return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';
}
