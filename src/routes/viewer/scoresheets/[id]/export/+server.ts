// Per-scoresheet CSV export for viewer — identical payload to admin variant.

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import { scoresheetToCsv, scoresheetFilename } from '$lib/results/csv';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { detail, error: err } = await fetchScoresheetDetail(locals.supabase, params.id);
	if (err || !detail) throw error(404, err ?? 'Scoresheet not found.');

	const body = scoresheetToCsv(detail);
	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${scoresheetFilename(detail)}"`,
			'Cache-Control': 'no-store'
		}
	});
};
