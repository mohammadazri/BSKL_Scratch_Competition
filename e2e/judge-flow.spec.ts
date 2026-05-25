/**
 * e2e/judge-flow.spec.ts — complete a Cat A scoresheet end-to-end.
 *
 * Pre-req: judge has at least one assignment, seeded via
 * scripts/seed-fake-event.ts. We pick the FIRST queue item regardless of
 * category, fill in every visible criterion at the "Proficient" level, enter
 * a sprint time (for cat B/C), and submit. Lands on /judge/done/[id].
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn, expectAutosaveSaved } from './fixtures';

test.describe('judge · scoresheet flow', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.judge);
	});

	test('judge fills every criterion + sprint time, submits, lands on done page', async ({
		page
	}) => {
		await page.goto('/judge');

		// Pick the first non-finalised row. Falls back to clicking the first
		// "Start" / "Continue" link in the queue.
		const firstActionLink = page
			.getByRole('link', { name: /start|continue/i })
			.first();
		await expect(firstActionLink).toBeVisible();
		await firstActionLink.click();

		await expect(page).toHaveURL(/\/judge\/score\//);

		// CriterionCard renders a set of RadioLevel buttons. Click "Proficient"
		// (or whatever the second level is) on each visible criterion card.
		const cards = page.locator('[data-test=criterion-card]');
		const cardCount = await cards.count();
		if (cardCount === 0) {
			// Fallback selector if data-test isn't wired.
			const proficientButtons = page.getByRole('radio', { name: /proficient/i });
			const n = await proficientButtons.count();
			expect(n).toBeGreaterThan(0);
			for (let i = 0; i < n; i++) await proficientButtons.nth(i).check();
		} else {
			for (let i = 0; i < cardCount; i++) {
				await cards.nth(i).getByRole('radio', { name: /proficient/i }).first().check();
			}
		}

		// Sprint time (cat B/C only). The field uses <TimeInput name="sprint_…">.
		const sprintInput = page.getByLabel(/sprint time/i).first();
		if (await sprintInput.isVisible().catch(() => false)) {
			// Format hh:mm or mm:ss depending on Track 3's implementation — try
			// the human-friendly path first.
			await sprintInput.fill('12:34');
		}

		// Wait for the autosave indicator to settle so we know the draft was
		// written before we try to submit.
		await expectAutosaveSaved(page);

		await page.getByRole('button', { name: /^submit$|finalise|finish/i }).first().click();

		// Submit confirm modal — accept.
		const confirmBtn = page.getByRole('button', { name: /yes|confirm|submit/i }).last();
		if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click();

		await expect(page).toHaveURL(/\/judge\/done\//, { timeout: 15_000 });
		await expect(page.getByText(/submitted/i).first()).toBeVisible();
	});
});
