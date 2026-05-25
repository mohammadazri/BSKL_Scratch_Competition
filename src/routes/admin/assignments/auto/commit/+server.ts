// POST /admin/assignments/auto/commit
// Apply an auto-assignment plan (replacing any existing assignments for the
// participants in the plan).
// Body: { buckets: [{ judge_id, participant_ids }, ...] }

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const buckets: { judge_id: string; participant_ids: string[] }[] = Array.isArray(body.buckets)
		? body.buckets
		: [];

	if (buckets.length === 0) return json({ error: 'no buckets supplied' }, { status: 400 });

	// Flatten + dedupe — one assignment per participant. Last write wins.
	const rows: { participant_id: string; judge_id: string }[] = [];
	for (const b of buckets) {
		if (!b.judge_id || !Array.isArray(b.participant_ids)) continue;
		for (const pid of b.participant_ids) {
			rows.push({ participant_id: pid, judge_id: b.judge_id });
		}
	}

	if (rows.length === 0) return json({ error: 'no assignments in buckets' }, { status: 400 });

	const participantIds = rows.map((r) => r.participant_id);

	// Wipe existing assignments for these participants so we can fully replace.
	const { error: delErr } = await supabaseAdmin
		.from('assignments')
		.delete()
		.in('participant_id', participantIds);
	if (delErr) return json({ error: delErr.message }, { status: 500 });

	// Bulk insert the new assignments.
	const { error: insErr } = await supabaseAdmin.from('assignments').insert(rows);
	if (insErr) return json({ error: insErr.message }, { status: 500 });

	return json({ ok: true, inserted: rows.length });
};
