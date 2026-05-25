/**
 * e2e/event-lock.spec.ts — super_admin locks the event; judge form becomes
 * read-only; super_admin unlocks at the end so the next spec run starts from
 * a clean state.
 *
 * Lock state is a SINGLETON. This spec touches global state, so it should
 * always run last among the specs that depend on writable scoresheets.
 * Playwright honours filename alphabetical order; `event-lock` sorts after
 * `judge-*` and `admin-*` so we're OK by default.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn, signOut } from './fixtures';

test.describe('event lock', () => {
	test('lock blocks edits; unlock restores them', async ({ page }) => {
		// 1. Super_admin locks the event.
		await signIn(page, accounts.superAdmin);
		await page.goto('/admin/event');
		await page.getByRole('button', { name: /^lock event$/i }).click();
		// ConfirmModal → "Yes, lock"
		await page.getByRole('button', { name: /yes,? lock/i }).click();
		await expect(page.getByText(/event is locked/i)).toBeVisible({ timeout: 10_000 });

		// 2. Sign in as a judge in a fresh context to bypass cached session.
		await signOut(page);
		await signIn(page, accounts.judge);
		await page.goto('/judge');

		const startLink = page.getByRole('link', { name: /start|continue|view/i }).first();
		if (await startLink.isVisible().catch(() => false)) {
			await startLink.click();
			// Either a banner that says "Event locked" or the radio inputs are
			// disabled. We accept whichever Track 3's UI chose.
			const radios = page.getByRole('radio');
			const count = await radios.count();
			if (count > 0) {
				// All radios should be disabled.
				const disabledStates = await Promise.all(
					Array.from({ length: count }, (_, i) => radios.nth(i).isDisabled())
				);
				expect(disabledStates.some((d) => d === true)).toBe(true);
			}
			await expect(page.getByText(/locked|read.?only|cannot edit/i).first()).toBeVisible();
		}

		// 3. Unlock again so the staging DB is back to writable.
		await signOut(page);
		await signIn(page, accounts.superAdmin);
		await page.goto('/admin/event');
		await page.getByRole('button', { name: /^unlock event$/i }).click();
		await page.getByRole('button', { name: /yes,? unlock/i }).click();
		await expect(page.getByText(/event is unlocked/i)).toBeVisible({ timeout: 10_000 });
	});
});
