// /admin/assignments — matrix loader.
// For each category we need: participants (in that category), eligible judges
// (active judges whose `categories[]` contains the category), and the current
// per-participant assignment.

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import type { Category } from '$lib/types';

export type PartLite = {
	id: string;
	fullName: string;
	schoolId: string;
	schoolName: string;
	assignedJudgeId: string | null;
};

export type JudgeLite = {
	id: string;
	fullName: string;
	categories: Category[];
};

export type ByCategory = Record<Category, PartLite[]>;

export const load: PageServerLoad = async () => {
	// Participants joined with school name. Skip DQ'd (qualified = false) —
	// assignment for those is meaningless.
	const { data: parts, error: pErr } = await supabaseAdmin
		.from('participants')
		.select('id, full_name, school_id, category, schools!inner(name)')
		.eq('qualified', true)
		.order('full_name');
	if (pErr) throw error(500, pErr.message);

	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, categories')
		.eq('role', 'judge')
		.eq('is_active', true)
		.order('full_name');

	const { data: assignments } = await supabaseAdmin
		.from('assignments')
		.select('participant_id, judge_id');
	const judgeFor = new Map<string, string>();
	for (const a of assignments ?? []) {
		judgeFor.set(a.participant_id as string, a.judge_id as string);
	}

	const byCategory: ByCategory = { A: [], B: [], C: [] };
	for (const p of parts ?? []) {
		const sch = (p as { schools?: { name?: string } | { name?: string }[] }).schools;
		const schoolName = Array.isArray(sch) ? (sch[0]?.name ?? '') : (sch?.name ?? '');
		byCategory[p.category as Category].push({
			id: p.id as string,
			fullName: p.full_name as string,
			schoolId: p.school_id as string,
			schoolName,
			assignedJudgeId: judgeFor.get(p.id as string) ?? null
		});
	}

	return {
		byCategory,
		judges: (judges ?? []).map((j) => ({
			id: j.id as string,
			fullName: j.full_name as string,
			categories: (j.categories ?? []) as Category[]
		})) satisfies JudgeLite[]
	};
};

export const actions: Actions = {
	// Swap a single participant's judge (or clear with judge_id=''/null).
	swap: async ({ request, locals }) => {
		const form = await request.formData();
		const participantId = String(form.get('participant_id') ?? '');
		const judgeIdRaw = String(form.get('judge_id') ?? '').trim();
		if (!participantId) return fail(400, { error: 'Missing participant_id.' });

		if (!judgeIdRaw) {
			const { error: delErr } = await locals.supabase
				.from('assignments')
				.delete()
				.eq('participant_id', participantId);
			if (delErr) return fail(400, { error: delErr.message });
			return { ok: true, message: 'Cleared assignment.' };
		}

		// UPSERT-like behaviour: delete-then-insert via a single statement is
		// cleaner because `participant_id` has a unique constraint.
		const { error: delErr } = await locals.supabase
			.from('assignments')
			.delete()
			.eq('participant_id', participantId);
		if (delErr) return fail(400, { error: delErr.message });

		const { error: insErr } = await locals.supabase
			.from('assignments')
			.insert({ participant_id: participantId, judge_id: judgeIdRaw });
		if (insErr) return fail(400, { error: insErr.message });

		return { ok: true, message: 'Assignment updated.' };
	}
};
