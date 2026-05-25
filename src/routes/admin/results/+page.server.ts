// /admin/results — leaderboard for super_admin.
// Role guard runs in /admin/+layout.server.ts (super_admin only).
// RLS guarantees super_admin sees every row in `final_rankings`.

import type { PageServerLoad } from './$types';
import {
	parseResultsFilters,
	fetchRankings,
	fetchSchoolOptions,
	computeTotals
} from '$lib/results/query';
import type { ResultsPageData } from '$lib/results/types';

export const load: PageServerLoad = async ({ locals, url }): Promise<ResultsPageData> => {
	const filters = parseResultsFilters(url.searchParams);
	const [{ rows, error }, schoolOptions] = await Promise.all([
		fetchRankings(locals.supabase, filters),
		fetchSchoolOptions(locals.supabase)
	]);

	return {
		rows,
		filters,
		schoolOptions,
		totals: computeTotals(rows),
		role: 'super_admin',
		loadError: error
	};
};
