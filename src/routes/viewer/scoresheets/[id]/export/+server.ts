// Per-scoresheet CSV export for viewers — identical to /admin/scoresheets
// version. Viewer role has SELECT on all needed tables (scoresheets, scores,
// criteria, profiles), so the data load works the same way.

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import { scoresheetToCsv, scoresheetFilename } from '$lib/results/csv';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { detail, error: err } = await fetchScoresheetDetail(
		locals.supabase,
		params.id
	);
	if (err || !detail) throw error(404, err ?? 'Scoresheet not found.');

	const body = scoresheetToCsv(detail);
	const filename = scoresheetFilename(detail);

	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
};
