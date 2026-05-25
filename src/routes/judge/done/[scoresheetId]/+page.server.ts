// Post-submit summary loader. Confirms the scoresheet is in a terminal state
// (submitted/finalised) and pulls a per-criterion recap for display.

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sortLevels, type RubricLevel } from '$lib/scoring';
import type { Category, PerfLevel } from '$lib/types';

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { profile } = await parent();

	const { data: sheet, error: sErr } = await locals.supabase
		.from('scoresheets')
		.select(
			'id, participant_id, judge_id, status, live_sprint_time_seconds, submitted_at'
		)
		.eq('id', params.scoresheetId)
		.maybeSingle();
	if (sErr || !sheet) {
		throw error(404, 'Scoresheet not found.');
	}
	if (sheet.judge_id !== profile.id && profile.role !== 'super_admin') {
		throw error(403, 'Not your scoresheet.');
	}

	const { data: participant } = await locals.supabase
		.from('participants')
		.select('id, full_name, category, theme, school_id')
		.eq('id', sheet.participant_id)
		.single();

	const { data: school } = participant
		? await locals.supabase
				.from('schools')
				.select('name')
				.eq('id', participant.school_id)
				.single()
		: { data: null };

	const { data: criteriaRows } = await locals.supabase
		.from('criteria')
		.select('id, section, name, max_points, sort_order')
		.eq('category', participant?.category)
		.order('section', { ascending: true })
		.order('sort_order', { ascending: true });

	const { data: levelRows } = await locals.supabase
		.from('criterion_levels')
		.select('id, criterion_id, level, min_pts, max_pts, descriptor');

	const { data: scoreRows } = await locals.supabase
		.from('scores')
		.select('criterion_id, level, points, comment')
		.eq('scoresheet_id', sheet.id);

	const { data: dqRow } = await locals.supabase
		.from('disqualifications')
		.select('reason, notes, cleared_by')
		.eq('scoresheet_id', sheet.id)
		.is('cleared_by', null)
		.maybeSingle();

	const levelsByCriterion = new Map<string, RubricLevel[]>();
	(levelRows ?? []).forEach((l) => {
		const arr = levelsByCriterion.get(l.criterion_id as string) ?? [];
		arr.push({
			id: l.id as string,
			level: l.level as PerfLevel,
			minPts: l.min_pts as number,
			maxPts: l.max_pts as number,
			descriptor: l.descriptor as string
		});
		levelsByCriterion.set(l.criterion_id as string, arr);
	});

	const lineItems = (criteriaRows ?? []).map((c) => {
		const score = scoreRows?.find((s) => s.criterion_id === c.id);
		return {
			id: c.id as string,
			section: c.section as 'A' | 'B',
			name: c.name as string,
			maxPoints: c.max_points as number,
			level: (score?.level as PerfLevel | undefined) ?? null,
			points: (score?.points as number | undefined) ?? null,
			comment: (score?.comment as string | null) ?? null,
			levels: sortLevels(levelsByCriterion.get(c.id as string) ?? [])
		};
	});

	const total = (scoreRows ?? []).reduce((sum, s) => sum + (s.points as number), 0);
	const maxTotal = (criteriaRows ?? []).reduce(
		(sum, c) => sum + (c.max_points as number),
		0
	);

	return {
		scoresheet: {
			id: sheet.id as string,
			status: sheet.status as 'draft' | 'submitted' | 'finalised',
			submittedAt: (sheet.submitted_at as string | null) ?? null,
			liveSprintTimeSeconds: (sheet.live_sprint_time_seconds as number | null) ?? null
		},
		participant: {
			id: participant?.id as string,
			fullName: (participant?.full_name as string | undefined) ?? '—',
			category: participant?.category as Category,
			theme: (participant?.theme as string | null) ?? null,
			schoolName: (school?.name as string | undefined) ?? '—'
		},
		lineItems,
		total,
		maxTotal,
		dq: dqRow
			? {
					reason: dqRow.reason as string,
					notes: dqRow.notes as string
				}
			: null
	};
};
