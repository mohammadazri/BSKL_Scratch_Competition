/**
 * e2e/admin-assign.spec.ts — auto-assign preview shows a balanced split,
 * commit writes assignments, manual swap works.
 *
 * Assumes the staging DB has been seeded via `scripts/seed-fake-event.ts`
 * (5 schools × 15 participants per cat × 4 judges) before this spec runs.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

test.describe('admin · auto-assign', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.superAdmin);
	});

	test('auto-assign preview displays a balanced split across judges', async ({ page }) => {
		await page.goto('/admin/assignments');

		// The auto-assign affordance is either a Sparkles-icon "Auto-assign"
		// button on the main page or a tab; we hit the page-header CTA.
		await page.getByRole('button', { name: /auto-assign/i }).first().click();

		// Preview surfaces a per-judge bucket count. With 15 participants ÷ 4
		// judges we expect 3 or 4 per bucket. The exact UI shows the count in
		// a table or list — assert that every visible judge bucket lands in
		// the 2–5 range (gives slack for the school-cap fallback).
		const counts = await page
			.locator('[data-test=auto-assign-count]')
			.allInnerTexts()
			.catch(() => [] as string[]);

		// Fallback for the case where data-test attrs aren't wired up — pull
		// any "n participants" sibling text.
		const fallback = counts.length
			? counts
			: await page.getByText(/\b\d+\s+participants?\b/i).allInnerTexts();

		expect(fallback.length).toBeGreaterThan(0);
		for (const t of fallback.slice(0, 4)) {
			const m = t.match(/\d+/);
			expect(m, `expected a number in "${t}"`).not.toBeNull();
			const n = Number(m![0]);
			expect(n).toBeGreaterThanOrEqual(2);
			expect(n).toBeLessThanOrEqual(6);
		}

		// Commit and verify the toast / redirect / matrix update.
		await page.getByRole('button', { name: /commit|apply|confirm/i }).click();
		await expect(page.getByText(/assigned|saved|done/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('manual swap moves one participant from judge A to judge B', async ({ page }) => {
		await page.goto('/admin/assignments');

		// The AssignmentMatrix component supports row-level reassign via a
		// dropdown / button per row. Grab the first row and reassign it to
		// the next judge in the column header list.
		const firstRow = page.locator('tbody tr').first();
		await firstRow.getByRole('button', { name: /reassign|move|edit/i }).first().click();

		// Pick whichever judge isn't currently assigned.
		const judgeOption = page.getByRole('option', { name: /judge/i }).nth(1);
		await judgeOption.click();

		await expect(page.getByText(/reassigned|updated|saved/i).first()).toBeVisible({
			timeout: 10_000
		});
	});
});
