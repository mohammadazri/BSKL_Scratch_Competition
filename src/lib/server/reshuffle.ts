// Section B re-shuffle for fairness — used by both the standalone
// /admin/assignments/reshuffle-section-b endpoint and the setPhase action on
// /admin/event (which auto-runs the shuffle when advancing to section_b).
//
// Pure shape: takes a category, runs the algorithm, returns a result. Errors
// bubble up as { ok: false, error } objects rather than throws so the
// caller can decide whether to abort the whole transition or continue.

import { supabaseAdmin } from '$lib/server/supabase';
import type { Category } from '$lib/types';

export type ReshuffleResult =
	| {
			ok: true;
			category: Category;
			buckets: Array<{
				judge_id: string;
				judge_name: string;
				participant_ids: string[];
				count: number;
			}>;
			conflicts: number;
			message: string;
	  }
	| {
			ok: false;
			category: Category;
			error: string;
			message: string;
			conflicts?: number;
	  };

export async function reshuffleSectionBForCategory(
	category: Category
): Promise<ReshuffleResult> {
	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, categories')
		.eq('role', 'judge')
		.eq('is_active', true);

	const eligible = (judges ?? []).filter((j) =>
		((j.categories ?? []) as Category[]).includes(category)
	);
	if (eligible.length < 2) {
		const msg = `Need ≥2 active judges in Cat ${category} for a fair re-shuffle (got ${eligible.length}).`;
		return { ok: false, category, error: msg, message: msg };
	}

	const { data: parts } = await supabaseAdmin
		.from('participants')
		.select('id, school_id')
		.eq('category', category)
		.eq('qualified', true);
	const participants = (parts ?? []).map((p) => ({
		id: p.id as string,
		school_id: p.school_id as string
	}));
	if (participants.length === 0) {
		return {
			ok: true,
			category,
			buckets: [],
			conflicts: 0,
			message: `No qualified participants in Cat ${category}.`
		};
	}

	// Section A assignments — who graded who in Section A?
	const { data: aRows } = await supabaseAdmin
		.from('assignments')
		.select('participant_id, judge_id')
		.eq('section', 'A')
		.in(
			'participant_id',
			participants.map((p) => p.id)
		);
	const sectionAJudgeByParticipant = new Map<string, string>();
	for (const r of aRows ?? []) {
		sectionAJudgeByParticipant.set(r.participant_id as string, r.judge_id as string);
	}

	const sortedParts = [...participants].sort((a, b) => a.id.localeCompare(b.id));
	const sortedJudges = [...eligible].sort((a, b) =>
		(a.id as string).localeCompare(b.id as string)
	);
	const J = sortedJudges.length;

	const buckets: Record<string, string[]> = {};
	for (const j of sortedJudges) buckets[j.id as string] = [];

	let conflicts = 0;
	for (let i = 0; i < sortedParts.length; i++) {
		const pid = sortedParts[i].id;
		const sectionAJudge = sectionAJudgeByParticipant.get(pid) ?? null;
		let chosen: string | null = null;
		for (let off = 1; off <= J; off++) {
			const candidateIdx = (i + off) % J;
			const candidate = sortedJudges[candidateIdx].id as string;
			if (candidate !== sectionAJudge) {
				chosen = candidate;
				break;
			}
		}
		if (!chosen) {
			chosen = sortedJudges[(i + 1) % J].id as string;
			conflicts += 1;
		}
		buckets[chosen].push(pid);
	}

	// Replace section='B' assignments for these participants.
	const partIds = sortedParts.map((p) => p.id);
	const { error: delErr } = await supabaseAdmin
		.from('assignments')
		.delete()
		.eq('section', 'B')
		.in('participant_id', partIds);
	if (delErr) {
		return { ok: false, category, error: delErr.message, message: delErr.message };
	}

	const toInsert: Array<{ participant_id: string; judge_id: string; section: 'B' }> = [];
	for (const [judgeId, pids] of Object.entries(buckets)) {
		for (const pid of pids) toInsert.push({ participant_id: pid, judge_id: judgeId, section: 'B' });
	}
	if (toInsert.length > 0) {
		const { error: insErr } = await supabaseAdmin.from('assignments').insert(toInsert);
		if (insErr) {
			return { ok: false, category, error: insErr.message, message: insErr.message };
		}
	}

	const judgeName = new Map<string, string>();
	for (const j of eligible) judgeName.set(j.id as string, j.full_name as string);

	const decorated = Object.entries(buckets).map(([judgeId, pids]) => ({
		judge_id: judgeId,
		judge_name: judgeName.get(judgeId) ?? '?',
		participant_ids: pids,
		count: pids.length
	}));

	const message =
		conflicts === 0
			? `Cat ${category}: ${sortedParts.length} participants re-shuffled to different Section B judges.`
			: `Cat ${category}: re-shuffled with ${conflicts} same-judge conflict(s) where no alternative was available.`;

	return { ok: true, category, buckets: decorated, conflicts, message };
}
