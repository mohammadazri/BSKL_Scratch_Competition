// /viewer/results — leaderboard for viewer role.
// Same loader as /admin/results; the only difference is role=viewer so the
// shared component hides any role-gated actions (none in the leaderboard
// itself, but the drill-in link goes to /viewer/scoresheets/[id] instead).
// Role guard runs in /viewer/+layout.server.ts (viewer + super_admin).

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
		role: 'viewer',
		loadError: error
	};
};
