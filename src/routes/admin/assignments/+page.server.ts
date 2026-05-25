// /admin/assignments — matrix view (one tab per category), auto-assign + swap.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { autoAssign } from '$lib/server/auto-assign';
import type { Category } from '$lib/types';

export type Judge = {
	id: string;
	name: string;
	categories: Category[];
};

export type Participant = {
	id: string;
	name: string;
	school: string;
	schoolId: string;
	category: Category;
	assignedJudgeId: string | null;
};

export const load: PageServerLoad = async () => {
	const { data: judges, error: jErr } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, role, categories, is_active')
		.in('role', ['judge', 'super_admin'])
		.eq('is_active', true)
		.order('full_name');
	if (jErr) throw error(500, jErr.message);

	const judgeList: Judge[] = (judges ?? []).map((j) => ({
		id: j.id as string,
		name: j.full_name as string,
		categories: (j.categories ?? ['A', 'B', 'C']) as Category[]
	}));

	const { data: parts, error: pErr } = await supabaseAdmin
		.from('participants')
		.select('id, full_name, school_id, category')
		.eq('qualified', true)
		.order('full_name');
	if (pErr) throw error(500, pErr.message);

	const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
	const schoolNameById = new Map<string, string>();
	for (const s of schools ?? []) schoolNameById.set(s.id as string, s.name as string);

	const { data: assigns } = await supabaseAdmin
		.from('assignments')
		.select('participant_id, judge_id');
	const judgeByParticipant = new Map<string, string>();
	for (const a of assigns ?? []) judgeByParticipant.set(a.participant_id as string, a.judge_id as string);

	const participants: Participant[] = (parts ?? []).map((p) => ({
		id: p.id as string,
		name: p.full_name as string,
		school: schoolNameById.get(p.school_id as string) ?? '—',
		schoolId: p.school_id as string,
		category: p.category as Category,
		assignedJudgeId: judgeByParticipant.get(p.id as string) ?? null
	}));

	return { judges: judgeList, participants };
};

function isCategory(v: string): v is Category {
	return v === 'A' || v === 'B' || v === 'C';
}

export const actions: Actions = {
	swap: async ({ request }) => {
		const form = await request.formData();
		const participantId = String(form.get('participant_id') ?? '');
		const judgeId = String(form.get('judge_id') ?? '');
		if (!participantId) return fail(400, { error: 'participant_id required' });

		if (!judgeId) {
			// Clear the assignment.
			const { error: delErr } = await supabaseAdmin
				.from('assignments')
				.delete()
				.eq('participant_id', participantId);
			if (delErr) return fail(400, { error: delErr.message });
			return { ok: true };
		}

		// Upsert (one assignment per participant).
		const { error: upErr } = await supabaseAdmin
			.from('assignments')
			.upsert({ participant_id: participantId, judge_id: judgeId }, { onConflict: 'participant_id' });
		if (upErr) return fail(400, { error: upErr.message });
		return { ok: true };
	}
};
