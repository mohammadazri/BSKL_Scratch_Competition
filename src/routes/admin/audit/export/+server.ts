// CSV streaming export for /admin/audit.
// Reuses the same filters as the table page (?actor=, ?action=, ?from=, ?to=, ?q=).
// RLS limits rows to what the requesting user can see — for super_admin, that's
// everything; for others it would naturally be restricted by their policies.

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
