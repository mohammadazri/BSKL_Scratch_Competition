// /admin/results — super_admin leaderboard loader.
// Role guard runs in src/routes/admin/+layout.server.ts (super_admin only).
// Reads from the `final_rankings` view via $lib/results/query; the heavy
// lifting (ordering + tiebreak via RANK()) happens in SQL.

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
		role: 'super_admin' as const,
		loadError: rankResult.error
	} satisfies ResultsPageData;
};
