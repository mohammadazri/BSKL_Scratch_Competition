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

// Section is now an explicit dimension on assignments. The regular auto-assign
// is for Section A (the at-home build). Section B uses /reshuffle-section-b
// which deliberately picks DIFFERENT judges for fairness.
type AssignmentSection = 'A' | 'B';

export const POST: RequestHandler = async ({ request, locals }) => {
	// SECURITY: +server.ts handlers don't run layout guards. Even though writes
	// go through locals.supabase (RLS-protected), we still want a clean 401/403
	// instead of letting an unauthenticated caller get RLS-flavoured errors,
	// and we want consistent audit attribution.
	await requireSuperAdmin(locals.user);
	const body = (await request.json().catch(() => null)) as {
		buckets?: Bucket[];
		section?: AssignmentSection;
	} | null;
	if (!body || !Array.isArray(body.buckets)) {
		return json({ ok: false, error: 'Missing buckets[].' }, { status: 400 });
	}
	// Default to Section A — that's the at-home build that all judges score
	// pre-event. Section B has its own /reshuffle-section-b endpoint.
	const section: AssignmentSection = body.section === 'B' ? 'B' : 'A';

	// Flatten + validate.
	const toInsert: { participant_id: string; judge_id: string; section: AssignmentSection }[] =
		[];
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
			toInsert.push({ participant_id: pid, judge_id: b.judge_id, section });
			allPartIds.add(pid);
		}
	}

	if (allPartIds.size === 0) {
		return json({ ok: true, created: 0, replaced: 0 });
	}

	// SAFETY: refuse to wipe assignments for participants who already have
	// submitted scoresheets in THIS section on a DIFFERENT judge. Otherwise a
	// re-run silently orphans that work onto the old judge's sheet and the
	// new judge starts blank.
	const allowOverride = new URL(request.url).searchParams.get('force') === '1';
	if (!allowOverride) {
		const { data: scoredSheets } = await locals.supabase
			.from('scoresheets')
			.select('participant_id, judge_id, status')
			.eq('section', section)
			.in('participant_id', [...allPartIds]);

		const wouldOrphan: Array<{ participant_id: string; judge_id: string }> = [];
		const newOwnerByParticipant = new Map<string, string>();
		for (const r of toInsert) newOwnerByParticipant.set(r.participant_id, r.judge_id);

		for (const sheet of scoredSheets ?? []) {
			const newOwner = newOwnerByParticipant.get(sheet.participant_id as string);
			const hasWork = sheet.status === 'submitted' || sheet.status === 'finalised';
			if (hasWork && newOwner && newOwner !== sheet.judge_id) {
				wouldOrphan.push({
					participant_id: sheet.participant_id as string,
					judge_id: sheet.judge_id as string
				});
			}
		}

		if (wouldOrphan.length > 0) {
			return json(
				{
					ok: false,
					error:
						`Refusing to re-assign: ${wouldOrphan.length} participant(s) already ` +
						`have submitted Section ${section} work on a different judge. ` +
						`Re-running auto-assign would orphan those scores. Either (1) keep ` +
						`the existing assignments, (2) clear the affected scoresheets first, ` +
						`or (3) re-call this endpoint with ?force=1 to discard that work.`,
					wouldOrphan
				},
				{ status: 409 }
			);
		}
	}

	// Delete existing Section-X assignments for these participants. Crucially
	// scoped by section so re-running Section A auto-assign does NOT wipe
	// Section B assignments (and vice versa).
	const { error: delErr } = await locals.supabase
		.from('assignments')
		.delete()
		.eq('section', section)
		.in('participant_id', [...allPartIds]);
	if (delErr) return json({ ok: false, error: delErr.message }, { status: 400 });

	const { error: insErr } = await locals.supabase.from('assignments').insert(toInsert);
	if (insErr) return json({ ok: false, error: insErr.message }, { status: 400 });

	return json({
		ok: true,
		section,
		created: toInsert.length,
		replaced: allPartIds.size
	});
};
