/**
 * e2e/admin-override.spec.ts — super_admin overrides one score; the audit log
 * shows a before/after diff.
 *
 * Pre-req: at least one scoresheet has been submitted (judge-flow.spec.ts
 * runs before this — alphabetical order and fullyParallel:false gives us
 * that). We jump to /admin/scoresheets via /admin/results which is the
 * supported drill-in path.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

test.describe('admin · override + audit', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.superAdmin);
	});

	test('override one criterion; audit log shows the before/after diff', async ({ page }) => {
		await page.goto('/admin/results');

		// Find a submitted scoresheet — leaderboard row links to the detail.
		const firstRow = page.locator('tbody tr').first();
		await expect(firstRow).toBeVisible();
		await firstRow.getByRole('link').first().click();

		await expect(page).toHaveURL(/\/admin\/scoresheets\//);

		// Open the override modal on the first criterion that has an
		// Override affordance.
		const overrideButton = page.getByRole('button', { name: /override/i }).first();
		await overrideButton.click();

		// OverrideModal — pick a different level + supply a reason.
		await page.getByRole('radio', { name: /developing|excellent/i }).first().check();
		await page.getByLabel(/reason/i).fill('e2e: forcing a score change to verify audit trail');
		await page.getByRole('button', { name: /save override|apply|confirm/i }).click();

		await expect(page.getByText(/override(d|n)/i).first()).toBeVisible({ timeout: 10_000 });

		// Cross-check the audit log.
		await page.goto('/admin/audit');
		const firstAuditRow = page.locator('tbody tr').first();
		await firstAuditRow.click();

		// JsonDiff renders a <table> of before/after fields. Look for any cell
		// that shows the "score" or "points" diff. We accept any non-empty diff.
		const diff = page.locator('[data-test=json-diff], table').filter({ hasText: /points|level/i });
		await expect(diff.first()).toBeVisible();
	});
});
