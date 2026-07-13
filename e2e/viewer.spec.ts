/**
 * e2e/viewer.spec.ts — viewer role gating.
 *
 * Asserts the viewer can reach /viewer/results and /viewer/audit but no
 * override / unlock affordances are rendered anywhere. Also asserts that
 * direct navigation to /admin/* lands them somewhere benign (redirect or
 * 403) — we don't expose privileged surfaces by URL.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

test.describe('viewer · read-only', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.viewer);
	});

	test('viewer landing page shows the live dashboard and useful navigation', async ({ page }) => {
		await page.goto('/viewer');
		await expect(page.getByRole('heading', { name: /live observer dashboard/i })).toBeVisible();
		await expect(page.getByRole('link', { name: /full leaderboard/i })).toBeVisible();
		await expect(page.getByText(/read-only by design/i)).toBeVisible();
		await expect(page.getByText(/tracks 4/i)).toHaveCount(0);
	});

	test('viewer reaches /viewer/results without any edit affordances', async ({ page }) => {
		await page.goto('/viewer/results');
		await expect(page).toHaveURL(/\/viewer\/results/);

		// No "Override" / "Unlock" / "Edit" / "Delete" buttons anywhere on the page.
		for (const label of ['override', 'unlock', 'delete', 'reassign']) {
			const matches = await page.getByRole('button', { name: new RegExp(label, 'i') }).count();
			expect(matches, `viewer should not see a "${label}" button`).toBe(0);
		}
	});

	test('viewer reaches /viewer/audit with export CSV but no mutation buttons', async ({ page }) => {
		await page.goto('/viewer/audit');
		await expect(page).toHaveURL(/\/viewer\/audit/);

		// Export is allowed.
		await expect(page.getByRole('button', { name: /export.*csv/i })).toBeVisible();

		// No raise-DQ, clear-DQ, override, unlock controls.
		for (const label of ['raise dq', 'clear dq', 'override', 'unlock']) {
			const matches = await page.getByRole('button', { name: new RegExp(label, 'i') }).count();
			expect(matches, `viewer should not see a "${label}" button`).toBe(0);
		}
	});

	test('viewer navigating to /admin gets redirected away (no privileged surface leak)', async ({
		page
	}) => {
		const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
		// Acceptable: 302 redirect handled client-side (URL is now /viewer or /login),
		// or a 403 page.
		const finalUrl = page.url();
		expect(finalUrl).not.toMatch(/\/admin($|\/)/);
		if (response) {
			// 200 after redirect, or a 4xx — both acceptable; never a 500.
			expect(response.status()).toBeLessThan(500);
		}
	});
});
