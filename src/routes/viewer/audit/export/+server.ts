// CSV export for /viewer/audit. Local JSONL on the Pi (migration 013).

import type { RequestHandler } from './$types';
import { parseFilters } from '$lib/audit/query';
import { streamAuditRows } from '$lib/server/audit-local';
import { streamRowsToCsv, exportFilename } from '$lib/audit/csv';

export const GET: RequestHandler = async ({ url }) => {
	const filters = parseFilters(url.searchParams);
	const rows = streamAuditRows(filters);
	const body = streamRowsToCsv(rows);

	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${exportFilename()}"`,
			'Cache-Control': 'no-store'
		}
	});
};
