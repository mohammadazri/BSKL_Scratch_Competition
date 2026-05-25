/**
 * e2e/judge-autosave.spec.ts — fill two criteria, hard-reload, draft persists.
 *
 * This is the spec that proves Track 3's autosave + restore path actually
 * works. We intentionally do NOT submit — the assertion is "after a full page
 * reload my partial selection is still there". Mirrors the most common event-
 * day failure mode (judge accidentally refreshes their iPad).
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn, expectAutosaveSaved } from './fixtures';

test.describe('judge · autosave + draft restore', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.judge);
	});

	test('partial score persists across a hard reload', async ({ page }) => {
		await page.goto('/judge');
		await page.getByRole('link', { name: /start|continue/i }).first().click();
		await expect(page).toHaveURL(/\/judge\/score\//);

		const url = page.url(); // capture for the reload assertion

		// Fill exactly two criteria — pick the first "Proficient" and the
		// second card's "Excellent" so we can distinguish them on reload.
		const proficient = page.getByRole('radio', { name: /proficient/i });
		const excellent = page.getByRole('radio', { name: /excellent/i });
		await expect(proficient.first()).toBeVisible();
		await expect(excellent.first()).toBeVisible();
		await proficient.first().check();
		await excellent.nth(1).check();

		// Wait for the save indicator to flip to "Saved" before we reload —
		// otherwise we're racing the autosave debounce.
		await expectAutosaveSaved(page);

		// Hard reload (no cache).
		await page.goto(url, { waitUntil: 'networkidle' });

		// Both selections should be restored.
		await expect(proficient.first()).toBeChecked();
		await expect(excellent.nth(1)).toBeChecked();
	});
});
