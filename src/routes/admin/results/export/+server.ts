// CSV export for /admin/results.
// Same query path as the page loader — applies whatever filters are in the
// query string. RLS limits rows to what the requesting user can see (super_admin
// = all).

import type { RequestHandler } from './$types';
import { parseResultsFilters, fetchRankings } from '$lib/results/query';
import { rankingRowsToCsv, resultsFilename } from '$lib/results/csv';

export const GET: RequestHandler = async ({ locals, url }) => {
	const filters = parseResultsFilters(url.searchParams);
	const { rows } = await fetchRankings(locals.supabase, filters);
	const body = rankingRowsToCsv(rows);

	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${resultsFilename()}"`,
			'Cache-Control': 'no-store'
		}
	});
};
