/**
 * e2e/leaderboard.spec.ts — tiebreak test.
 *
 * Strategy: rather than asking Playwright to fabricate two scoresheets with
 * identical totals (which would require either DB writes via the service-
 * role harness or a long sequence of UI actions), we rely on the staging
 * seed having produced a state where AT LEAST TWO scoresheets share a total.
 * If that hasn't happened naturally, this spec is skipped with a hint that
 * Mohammad should run the dry-run to generate the right data.
 *
 * When the data exists, we assert: within a single tied total bucket, the
 * row with the smaller sprint time appears HIGHER (lower rank number).
 * Matches SCHEMA.md `final_rankings` ORDER BY:
 *   total DESC, sprint_time ASC NULLS LAST.
 */
import { expect, test } from '@playwright/test';
import { accounts, signIn } from './fixtures';

test.describe('leaderboard · tiebreak', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, accounts.viewer);
	});

	test('two rows with identical totals are ordered by sprint time ascending', async ({ page }) => {
		await page.goto('/viewer/results');

		// Read every visible row as { rank, total, sprint }.
		const rows = await page.locator('tbody tr').all();
		if (rows.length < 2) test.skip(true, 'not enough leaderboard rows to detect a tie');

		type Row = { rank: number; total: number; sprintSeconds: number | null };
		const parsed: Row[] = [];
		for (const r of rows) {
			const cells = await r.locator('td').allInnerTexts();
			// Best-effort parse: leaderboard layout differs slightly between
			// admin / viewer variants. We look for the first 3-digit-ish
			// number as the rank, the largest number as total, and a mm:ss
			// pattern for sprint.
			const text = cells.join(' | ');
			const rankM = text.match(/^\s*(\d{1,3})/);
			const totalM = [...text.matchAll(/\b(\d{2,3})\b/g)].map((m) => Number(m[1]));
			const sprintM = text.match(/(\d{1,2}):(\d{2})/);
			if (!rankM || totalM.length === 0) continue;
			parsed.push({
				rank: Number(rankM[1]),
				total: Math.max(...totalM),
				sprintSeconds: sprintM ? Number(sprintM[1]) * 60 + Number(sprintM[2]) : null
			});
		}

		// Find a tie. If none, skip.
		let tieIndex = -1;
		for (let i = 0; i < parsed.length - 1; i++) {
			if (parsed[i].total === parsed[i + 1].total) {
				tieIndex = i;
				break;
			}
		}
		if (tieIndex < 0) {
			test.skip(true, 'no tied totals in current staging data — run dry-run to set one up');
		}

		const a = parsed[tieIndex];
		const b = parsed[tieIndex + 1];
		expect(a.total).toBe(b.total);
		// Sprint asc NULLS LAST → null pushed to the bottom; otherwise smaller wins.
		if (a.sprintSeconds == null && b.sprintSeconds == null) {
			// Indistinguishable — schema lets ties stand.
			return;
		}
		if (a.sprintSeconds == null) {
			throw new Error('row above has NULL sprint but row below has a value — NULLS LAST violated');
		}
		if (b.sprintSeconds == null) return; // a < null per NULLS LAST
		expect(
			a.sprintSeconds,
			`tie at total ${a.total}: row ${a.rank} sprint=${a.sprintSeconds}s should be <= row ${b.rank} sprint=${b.sprintSeconds}s`
		).toBeLessThanOrEqual(b.sprintSeconds);
	});
});
