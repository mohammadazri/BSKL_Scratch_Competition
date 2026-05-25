// CSV export for /viewer/results.
// Same query path as the page loader. Viewers have full SELECT via RLS so the
// CSV they pull is identical to what super_admin sees — by design, the
// observer view is fully transparent.

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
