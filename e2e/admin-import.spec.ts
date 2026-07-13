/**
 * e2e/admin-import.spec.ts — CSV import for schools + participants.
 *
 * Strategy: build the CSV payload in-test, upload via the file input,
 * verify the preview shows the parsed rows, commit, verify they appear on
 * the listing. We use a unique "[e2e-import]" prefix so this spec is
 * idempotent — a leftover row from a previous failed run won't break this run
 * (we delete-and-recreate via the admin UI's row actions, falling back to
 * Mohammad cleaning seed data between runs).
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

const STAMP = `${Date.now()}`;
const SCHOOL_CSV = [
	'name,short_code',
	`[e2e-import-${STAMP}] Pluto Coding Club,PLUTO`,
	`[e2e-import-${STAMP}] Neptune Robotics Lab,NEP`
].join('\n');

const PARTICIPANT_CSV = [
	'full_name,school_name,category,theme,scratch_username,scratch_password',
	`[e2e-import-${STAMP}] Ada Lovelace,[e2e-import-${STAMP}] Pluto Coding Club,A,Eco-Warriors,e2e-ada-${STAMP},scratch-pass-${STAMP}`,
	`[e2e-import-${STAMP}] Grace Hopper,[e2e-import-${STAMP}] Neptune Robotics Lab,B,Smart Cities,e2e-grace-${STAMP},scratch-pass-${STAMP}`
].join('\n');

test.describe('admin · CSV import', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.superAdmin);
	});

	test('schools CSV: preview shows parsed rows, commit creates them', async ({ page }) => {
		await page.goto('/admin/schools');
		await page.getByRole('button', { name: /import csv/i }).click();

		// CsvUpload component renders a hidden <input type=file>; Playwright
		// can set its files directly.
		const fileInput = page.locator('input[type=file]').first();
		await fileInput.setInputFiles({
			name: 'schools.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(SCHOOL_CSV)
		});

		// Preview should show both school names. Use exact text — substring match
		// keyed on the stamp keeps this spec robust to other fixtures.
		await expect(page.getByText(`[e2e-import-${STAMP}] Pluto Coding Club`)).toBeVisible();
		await expect(page.getByText(`[e2e-import-${STAMP}] Neptune Robotics Lab`)).toBeVisible();

		await page.getByRole('button', { name: /commit|import|confirm/i }).click();

		// After commit, the modal closes and the table contains both rows.
		await expect(page.getByText(`[e2e-import-${STAMP}] Pluto Coding Club`)).toBeVisible();
		await expect(page.getByText(`[e2e-import-${STAMP}] Neptune Robotics Lab`)).toBeVisible();
	});

	test('participants CSV: preview + commit + dq toggle', async ({ page }) => {
		// Pre-req: the two schools above must exist (the schools spec creates
		// them; runs in deterministic order because we set fullyParallel:false).
		await page.goto('/admin/participants');
		await page.getByRole('button', { name: /import csv/i }).click();

		const fileInput = page.locator('input[type=file]').first();
		await fileInput.setInputFiles({
			name: 'participants.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(PARTICIPANT_CSV)
		});

		await expect(page.getByRole('button', { name: 'Import 2 participants' })).toBeVisible();

		await page.getByRole('button', { name: /commit|import|confirm/i }).click();

		await expect(page.getByText(`[e2e-import-${STAMP}] Ada Lovelace`)).toBeVisible();

		// Toggle DQ on Ada — find her row, click the qualified toggle, confirm
		// the visual cue flips. The exact selector depends on DataTable
		// internals; we look for the row-scoped toggle by accessible name.
		const adaRow = page.getByRole('row', { name: new RegExp(`Ada Lovelace`) });
		await adaRow.getByRole('button', { name: /dq|disqualify|qualified/i }).click();
		await page.getByRole('textbox', { name: /notes/i }).fill('E2E import disqualification check.');
		await page.getByRole('button', { name: 'Disqualify', exact: true }).click();
		await expect(adaRow.getByText(/dq|disqualified/i)).toBeVisible();
	});
});
