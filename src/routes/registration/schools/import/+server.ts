// POST /registration/schools/import — bulk-insert schools from a parsed CSV.
// Mirror of /admin/schools/import but accessible to the registration committee.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireRegistrationOrAdmin } from '$lib/server/guards';

/** Hard cap on inbound import payload — protects against memory-exhaustion DoS. */
const MAX_IMPORT_ROWS = 2000;

interface RowIn {
	name?: unknown;
	short_code?: unknown;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// SECURITY: +server.ts handlers don't run layout guards. Block anyone
	// who isn't super_admin or registration_committee before parsing the body.
	await requireRegistrationOrAdmin(locals.user);

	const body = (await request.json().catch(() => null)) as { rows?: RowIn[] } | null;
	if (!body || !Array.isArray(body.rows)) {
		return json({ ok: false, error: 'Missing or malformed rows[].' }, { status: 400 });
	}
	if (body.rows.length > MAX_IMPORT_ROWS) {
		return json(
			{ ok: false, error: `Too many rows (${body.rows.length}). Limit is ${MAX_IMPORT_ROWS}.` },
			{ status: 413 }
		);
	}

	let created = 0;
	let skipped = 0;
	const errors: { line: number; message: string }[] = [];

	// Pull existing names once to avoid N round-trips.
	const { data: existing } = await supabaseAdmin.from('schools').select('id, name');
	const seen = new Set((existing ?? []).map((s) => (s.name as string).toLowerCase()));

	const toInsert: { name: string; short_code: string | null }[] = [];
	let i = 0;
	for (const r of body.rows) {
		i++;
		const name = typeof r.name === 'string' ? r.name.trim() : '';
		if (!name) {
			errors.push({ line: i, message: 'missing name' });
			continue;
		}
		if (seen.has(name.toLowerCase())) {
			skipped++;
			continue;
		}
		toInsert.push({
			name,
			short_code: typeof r.short_code === 'string' && r.short_code.trim() ? r.short_code.trim() : null
		});
		seen.add(name.toLowerCase());
	}

	if (toInsert.length > 0) {
		// Insert via the request-scoped client so audit rows get a real actor_id.
		const { error: insErr } = await locals.supabase.from('schools').insert(toInsert);
		if (insErr) {
			return json({ ok: false, error: insErr.message }, { status: 400 });
		}
		created = toInsert.length;
	}

	return json({ ok: true, created, skipped, errors });
};
