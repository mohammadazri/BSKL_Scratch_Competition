// POST /admin/assignments/auto — runs the auto-assign algorithm and returns
// a preview (no DB writes). Body: { category: 'A'|'B'|'C', maxPerSchool?: number }.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { autoAssign } from '$lib/server/auto-assign';
import type { Category } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => null)) as
		| { category?: Category; maxPerSchool?: number }
		| null;
	if (!body || !body.category) {
		return json({ ok: false, error: 'Missing category.' }, { status: 400 });
	}
	const category = body.category;
	const maxPerSchool = body.maxPerSchool ?? 3;

	const { data: parts } = await supabaseAdmin
		.from('participants')
		.select('id, school_id, schools!inner(name)')
		.eq('category', category)
		.eq('qualified', true);

	const schoolNameById = new Map<string, string>();
	for (const p of parts ?? []) {
		const sch = (p as { schools?: { name?: string } | { name?: string }[] }).schools;
		const n = Array.isArray(sch) ? (sch[0]?.name ?? '') : (sch?.name ?? '');
		schoolNameById.set(p.school_id as string, n);
	}

	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, categories')
		.eq('role', 'judge')
		.eq('is_active', true);

	const eligible = (judges ?? []).filter((j) =>
		((j.categories ?? []) as Category[]).includes(category)
	);
	if (eligible.length === 0) {
		return json(
			{ ok: false, error: `No active judges are qualified for category ${category}.` },
			{ status: 400 }
		);
	}

	const plan = autoAssign({
		participants: (parts ?? []).map((p) => ({
			id: p.id as string,
			school_id: p.school_id as string
		})),
		judges: eligible.map((j) => ({ id: j.id as string })),
		maxPerSchoolPerJudge: maxPerSchool
	});

	// Decorate with judge names + per-school breakdowns.
	const judgeName = new Map<string, string>();
	for (const j of eligible) judgeName.set(j.id as string, j.full_name as string);

	const decorated = plan.map((b) => {
		const counts = new Map<string, number>();
		for (const pid of b.participant_ids) {
			const part = (parts ?? []).find((p) => p.id === pid);
			const schoolId = part?.school_id as string | undefined;
			if (!schoolId) continue;
			const name = schoolNameById.get(schoolId) ?? '?';
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
		return {
			judge_id: b.judge_id,
			judge_name: judgeName.get(b.judge_id) ?? '?',
			participant_ids: b.participant_ids,
			school_breakdown: [...counts.entries()]
				.map(([school_name, count]) => ({ school_name, count }))
				.sort((a, b) => b.count - a.count)
		};
	});

	return json({
		ok: true,
		category,
		eligibleJudgeNames: eligible.map((j) => j.full_name as string),
		maxPerSchool,
		buckets: decorated
	});
};
