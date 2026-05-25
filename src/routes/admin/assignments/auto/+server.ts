// POST /admin/assignments/auto
// Compute (but do not commit) an auto-assignment plan for a category.
// Body: { category: 'A' | 'B' | 'C', maxPerSchool?: number }
// Returns the planned buckets + school breakdown for the preview modal.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { autoAssign } from '$lib/server/auto-assign';
import type { Category } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const category = body.category as Category;
	const maxPerSchool = Number(body.maxPerSchool ?? 3);

	if (!category || !['A', 'B', 'C'].includes(category)) {
		return json({ error: 'category must be A, B or C' }, { status: 400 });
	}

	const { data: judges, error: jErr } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, categories')
		.in('role', ['judge', 'super_admin'])
		.eq('is_active', true)
		.contains('categories', [category]);
	if (jErr) return json({ error: jErr.message }, { status: 500 });

	const eligible = judges ?? [];
	if (eligible.length === 0) {
		return json({ error: `No active judges are qualified for category ${category}.` }, { status: 400 });
	}

	const { data: participants, error: pErr } = await supabaseAdmin
		.from('participants')
		.select('id, full_name, school_id')
		.eq('qualified', true)
		.eq('category', category);
	if (pErr) return json({ error: pErr.message }, { status: 500 });

	const parts = participants ?? [];
	if (parts.length === 0) {
		return json({ error: `No qualified participants in category ${category}.` }, { status: 400 });
	}

	const buckets = autoAssign({
		participants: parts.map((p) => ({ id: p.id as string, school_id: p.school_id as string })),
		judges: eligible.map((j) => ({ id: j.id as string })),
		maxPerSchoolPerJudge: maxPerSchool
	});

	const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
	const schoolNameById = new Map<string, string>();
	for (const s of schools ?? []) schoolNameById.set(s.id as string, s.name as string);
	const schoolByParticipant = new Map<string, string>();
	for (const p of parts) {
		schoolByParticipant.set(p.id as string, p.school_id as string);
	}

	const judgeNameById = new Map<string, string>();
	for (const j of eligible) judgeNameById.set(j.id as string, j.full_name as string);

	const enriched = buckets.map((b) => {
		const counts = new Map<string, number>();
		for (const pid of b.participant_ids) {
			const sid = schoolByParticipant.get(pid);
			if (!sid) continue;
			const name = schoolNameById.get(sid) ?? '—';
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
		const breakdown = [...counts.entries()]
			.map(([school_name, count]) => ({ school_name, count }))
			.sort((a, b) => b.count - a.count);
		return {
			judge_id: b.judge_id,
			judge_name: judgeNameById.get(b.judge_id) ?? '—',
			participant_ids: b.participant_ids,
			school_breakdown: breakdown
		};
	});

	return json({
		category,
		maxPerSchool,
		eligibleJudgeNames: eligible.map((j) => j.full_name as string),
		buckets: enriched,
		totalParticipants: parts.length
	});
};
