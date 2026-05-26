// POST /admin/assignments/auto/commit — apply a previously-generated plan.
// Body: { buckets: [{ judge_id, participant_ids: string[] }] }
// Strategy: delete existing assignments for the involved participants, then
// insert the new ones. (UPSERT on a unique constraint via Supabase is fiddlier
// than delete-then-insert when there's no surrogate `id` provided.)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSuperAdmin } from '$lib/server/guards';

interface Bucket {
	judge_id?: unknown;
	participant_ids?: unknown;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// SECURITY: +server.ts handlers don't run layout guards. Even though writes
	// go through locals.supabase (RLS-protected), we still want a clean 401/403
	// instead of letting an unauthenticated caller get RLS-flavoured errors,
	// and we want consistent audit attribution.
	await requireSuperAdmin(locals.user);
	const body = (await request.json().catch(() => null)) as { buckets?: Bucket[] } | null;
	if (!body || !Array.isArray(body.buckets)) {
		return json({ ok: false, error: 'Missing buckets[].' }, { status: 400 });
	}

	// Flatten + validate.
	const toInsert: { participant_id: string; judge_id: string }[] = [];
	const allPartIds = new Set<string>();
	for (const b of body.buckets) {
		if (typeof b.judge_id !== 'string') {
			return json({ ok: false, error: 'Bad judge_id.' }, { status: 400 });
		}
		if (!Array.isArray(b.participant_ids)) {
			return json({ ok: false, error: 'Bad participant_ids.' }, { status: 400 });
		}
		for (const pid of b.participant_ids) {
			if (typeof pid !== 'string') continue;
			toInsert.push({ participant_id: pid, judge_id: b.judge_id });
			allPartIds.add(pid);
		}
	}

	if (allPartIds.size === 0) {
		return json({ ok: true, created: 0, replaced: 0 });
	}

	// Delete existing assignments for these participants.
	const { error: delErr } = await locals.supabase
		.from('assignments')
		.delete()
		.in('participant_id', [...allPartIds]);
	if (delErr) return json({ ok: false, error: delErr.message }, { status: 400 });

	const { error: insErr } = await locals.supabase.from('assignments').insert(toInsert);
	if (insErr) return json({ ok: false, error: insErr.message }, { status: 400 });

	return json({ ok: true, created: toInsert.length, replaced: allPartIds.size });
};
