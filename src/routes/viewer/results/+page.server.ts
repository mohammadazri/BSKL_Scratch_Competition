// /viewer/results — read-only leaderboard.
// Role guard runs in src/routes/viewer/+layout.server.ts (viewer or super_admin).
// Identical data shape as /admin/results; only the `role` flag differs, which
// drives drill-row href and hides the override/unlock affordances downstream.

import type { PageServerLoad } from './$types';
import {
	parseResultsFilters,
	fetchRankings,
	fetchSchoolOptions,
	computeTotals
} from '$lib/results/query';
import type { ResultsPageData } from '$lib/results/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = parseResultsFilters(url.searchParams);
	const [rankResult, schoolOptions] = await Promise.all([
		fetchRankings(locals.supabase, filters),
		fetchSchoolOptions(locals.supabase)
	]);

	return {
		rows: rankResult.rows,
		filters,
		schoolOptions,
		totals: computeTotals(rankResult.rows),
		role: 'viewer' as const,
		loadError: rankResult.error
	} satisfies ResultsPageData;
};
