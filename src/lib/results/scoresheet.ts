// Loader for the per-scoresheet drill-in page.
//
// Re-used by /admin/scoresheets/[id] and /viewer/scoresheets/[id].
// RLS handles row-level access — viewer + super_admin both see all sheets;
// judges only see their own. The page should never be exposed to judges.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	ScoresheetDetail,
	ScoreLineItem,
	SectionGroup
} from './types';
import type { Category, PerfLevel, Theme, ScoresheetStatus } from '$lib/types';
import { sortLevels } from '$lib/scoring';

export async function fetchScoresheetDetail(
	supabase: SupabaseClient,
	scoresheetId: string
): Promise<{ detail: ScoresheetDetail | null; error: string | null }> {
	// 1. The scoresheet header.
	const { data: sheet, error: sErr } = await supabase
		.from('scoresheets')
		.select(
			'id, participant_id, judge_id, status, live_sprint_time_seconds, submitted_at'
		)
		.eq('id', scoresheetId)
		.maybeSingle();
	if (sErr) return { detail: null, error: sErr.message };
	if (!sheet) return { detail: null, error: 'Scoresheet not found.' };

	// 2. Participant + school.
	const { data: participant, error: pErr } = await supabase
		.from('participants')
		.select('id, full_name, category, theme, school_id')
		.eq('id', sheet.participant_id)
		.single();
	if (pErr || !participant)
		return { detail: null, error: 'Participant not found.' };

	const { data: school } = await supabase
		.from('schools')
		.select('name')
		.eq('id', participant.school_id)
		.single();

	// 3. Judge.
	const { data: judge } = await supabase
		.from('profiles')
		.select('full_name, email')
		.eq('id', sheet.judge_id)
		.maybeSingle();

	// 4. Criteria for this category (sorted).
	const { data: criteriaRows, error: cErr } = await supabase
		.from('criteria')
		.select('id, category, section, name, max_points, sort_order')
		.eq('category', participant.category)
		.order('section', { ascending: true })
		.order('sort_order', { ascending: true });
	if (cErr || !criteriaRows)
		return { detail: null, error: `Failed to load rubric: ${cErr?.message ?? ''}` };

	const criterionIds = criteriaRows.map((c) => c.id as string);
	const { data: levelRows } = await supabase
		.from('criterion_levels')
		.select('id, criterion_id, level, min_pts, max_pts, descriptor')
		.in('criterion_id', criterionIds);

	const levelsByCriterion = new Map<
		string,
		{ id: string; level: PerfLevel; minPts: number; maxPts: number; descriptor: string }[]
	>();
	for (const l of levelRows ?? []) {
		const arr = levelsByCriterion.get(l.criterion_id as string) ?? [];
		arr.push({
			id: l.id as string,
			level: l.level as PerfLevel,
			minPts: l.min_pts as number,
			maxPts: l.max_pts as number,
			descriptor: l.descriptor as string
		});
		levelsByCriterion.set(l.criterion_id as string, arr);
	}

	// 5. Existing scores on this sheet.
	const { data: scoreRows } = await supabase
		.from('scores')
		.select(
			'id, criterion_id, level, points, comment, is_override, override_reason'
		)
		.eq('scoresheet_id', sheet.id);

	type ScoreRowShape = {
		id: string;
		criterion_id: string;
		level: PerfLevel;
		points: number;
		comment: string | null;
		is_override: boolean;
		override_reason: string | null;
	};
	const scoreByCriterion = new Map<string, ScoreRowShape>();
	for (const s of (scoreRows ?? []) as unknown as ScoreRowShape[]) {
		scoreByCriterion.set(s.criterion_id, s);
	}

	// 6. Stitch into per-section groups.
	const lineItems: ScoreLineItem[] = criteriaRows.map((c) => {
		const cid = c.id as string;
		const score = scoreByCriterion.get(cid);
		return {
			scoreId: score ? score.id : null,
			criterionId: cid,
			criterionName: c.name as string,
			sortOrder: c.sort_order as number,
			maxPoints: c.max_points as number,
			level: score ? score.level : null,
			points: score ? score.points : null,
			comment: score ? (score.comment ?? null) : null,
			isOverride: score ? Boolean(score.is_override) : false,
			overrideReason: score ? (score.override_reason ?? null) : null,
			levelBands: sortLevels(levelsByCriterion.get(cid) ?? [])
		};
	});

	const sectionMap = new Map<'A' | 'B', ScoreLineItem[]>();
	for (let i = 0; i < lineItems.length; i++) {
		const sec = (criteriaRows[i].section as 'A' | 'B') ?? 'A';
		const arr = sectionMap.get(sec) ?? [];
		arr.push(lineItems[i]);
		sectionMap.set(sec, arr);
	}

	const sectionLabels: Record<'A' | 'B', string> = {
		A: 'Section A — Phase 1 At-Home Build',
		B: 'Section B — Live Sprint Mystery'
	};

	const sections: SectionGroup[] = (['A', 'B'] as const)
		.filter((sec) => sectionMap.has(sec))
		.map((sec) => {
			const items = sectionMap.get(sec) ?? [];
			const subtotal = items.reduce((acc, it) => acc + (it.points ?? 0), 0);
			const maxSubtotal = items.reduce((acc, it) => acc + it.maxPoints, 0);
			return { section: sec, label: sectionLabels[sec], scores: items, subtotal, maxSubtotal };
		});

	const totalPoints = sections.reduce((acc, s) => acc + s.subtotal, 0);
	const maxPoints = sections.reduce((acc, s) => acc + s.maxSubtotal, 0);

	return {
		detail: {
			scoresheetId: sheet.id as string,
			participantId: participant.id as string,
			participantName: participant.full_name as string,
			schoolName: (school?.name as string | undefined) ?? '—',
			category: participant.category as Category,
			theme: (participant.theme as Theme | null) ?? null,
			judgeId: sheet.judge_id as string,
			judgeName: (judge?.full_name as string | undefined) ?? '—',
			judgeEmail: (judge?.email as string | undefined) ?? '',
			status: sheet.status as ScoresheetStatus,
			liveSprintTimeSeconds:
				(sheet.live_sprint_time_seconds as number | null) ?? null,
			submittedAt: (sheet.submitted_at as string | null) ?? null,
			totalPoints,
			maxPoints,
			sections
		},
		error: null
	};
}
