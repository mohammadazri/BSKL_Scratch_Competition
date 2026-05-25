// CSV export for /viewer/audit. Same stream as /admin, RLS-filtered for viewer.

import type { RequestHandler } from './$types';
import { parseFilters, streamAuditRows } from '$lib/audit/query';
import { streamRowsToCsv, exportFilename } from '$lib/audit/csv';

export const GET: RequestHandler = async ({ locals, url }) => {
	const filters = parseFilters(url.searchParams);
	const rows = streamAuditRows(locals.supabase, filters);
	const body = streamRowsToCsv(rows);

	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${exportFilename()}"`,
			'Cache-Control': 'no-store'
		}
	});
};
