/**
 * e2e/admin-users.spec.ts — super_admin creates a judge, edits role, deactivates.
 *
 * Strategy:
 *   • Open /admin/users, click "New user".
 *   • Fill the form with a unique `[e2e-user-<stamp>]` email so the spec is
 *     idempotent across runs and won't collide with seeded fixtures.
 *   • Verify the success banner (with the generated temp password) appears.
 *   • Find the new row in the table, deactivate, confirm the status flips
 *     to "Disabled". Reactivate at the end so the row doesn't accumulate
 *     stale-disabled noise on the staging dashboard.
 *
 * We intentionally do NOT exercise email delivery — temp passwords are
 * surfaced in-UI on the green success banner, which is the production
 * "print the slip" path.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

const STAMP = `${Date.now()}`;
const NEW_EMAIL = `e2e-user-${STAMP}@seed.p3-judging.local`;
const NEW_NAME = `[e2e-user-${STAMP}] Test Judge`;

test.describe('admin · user management', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.superAdmin);
	});

	test('create judge, see temp password, deactivate + reactivate', async ({ page }) => {
		await page.goto('/admin/users');

		// 1. Open Create modal.
		await page.getByRole('button', { name: /^new user$/i }).click();

		// 2. Fill required fields. Role defaults to "judge" → Categories
		//    fieldset is visible with A/B/C all pre-checked.
		await page.getByLabel(/^email$/i).fill(NEW_EMAIL);
		await page.getByLabel(/full name/i).fill(NEW_NAME);
		await page.getByLabel(/pin label/i).fill('Sticky #e2e');

		await page.getByRole('button', { name: /^create$/i }).click();

		// 3. Success banner with the (visible-once) temp password.
		const banner = page.getByText(/temp password:/i);
		await expect(banner).toBeVisible({ timeout: 10_000 });

		// 4. Row appears in the table.
		const userRow = page.getByRole('row', { name: new RegExp(NEW_NAME) });
		await expect(userRow).toBeVisible();
		await expect(userRow.getByText(/active/i)).toBeVisible();

		// 5. Deactivate (Power icon button, danger color when active).
		await userRow.getByRole('button', { name: /^deactivate$/i }).click();

		// ConfirmModal — accept.
		await page.getByRole('button', { name: /yes,? deactivate|confirm|deactivate/i }).last().click();

		// Status flips to Disabled.
		await expect(userRow.getByText(/disabled/i)).toBeVisible({ timeout: 10_000 });

		// 6. Reactivate so the test doesn't leave noise behind. After
		//    deactivation the same Power button's aria-label flips to
		//    "Reactivate".
		await userRow.getByRole('button', { name: /^reactivate$/i }).click();
		await page.getByRole('button', { name: /yes,? reactivate|confirm|reactivate/i }).last().click();
		await expect(userRow.getByText(/active/i)).toBeVisible({ timeout: 10_000 });
	});

	test('edit role: switch new judge to viewer; categories fieldset hides', async ({ page }) => {
		// Pre-req: the previous test created the user. If it didn't run (e.g.
		// someone filtered specs), we skip — admin-users.spec.ts is a single
		// describe block so beforeEach + the order above guarantee it.
		await page.goto('/admin/users');
		const userRow = page.getByRole('row', { name: new RegExp(NEW_NAME) });
		if (!(await userRow.isVisible().catch(() => false))) {
			test.skip(true, 'create-user spec did not run; nothing to edit');
		}

		await userRow.getByRole('button', { name: /^edit$/i }).click();

		// Switch role → viewer. The categories fieldset should disappear.
		await page.getByLabel(/^role$/i).selectOption('viewer');
		await expect(page.getByText(/^categories\b/i)).toHaveCount(0);

		await page.getByRole('button', { name: /save changes/i }).click();

		// Row's role pill now reads "Viewer".
		await expect(userRow.getByText(/viewer/i)).toBeVisible({ timeout: 10_000 });
	});
});
