import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireSuperAdmin } from '$lib/server/guards';
import type { PerfLevel } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireSuperAdmin(locals.user);

	const participantId = params.participantId;

	// 1. Fetch participant info
	const { data: p, error: pErr } = await locals.supabase
		.from('participants')
		.select('id, full_name, category, theme, schools ( name )')
		.eq('id', participantId)
		.single();

	if (pErr || !p) {
		throw error(404, 'Participant not found');
	}

	// 2. Fetch both scoresheets (Section A and Section B) if they exist
	const { data: sheets, error: sErr } = await locals.supabase
		.from('scoresheets')
		.select('id, section, judge_id, live_sprint_time_seconds, status, profiles!judge_id ( full_name )')
		.eq('participant_id', participantId)
		.in('status', ['submitted', 'finalised']);

	if (sErr) throw error(500, sErr.message);

	const sheetIds = (sheets || []).map(s => s.id);
	
	// 3. Fetch all criteria for this category
	const { data: allCriteria, error: cErr } = await locals.supabase
		.from('criteria')
		.select('id, name, section, max_points, sort_order')
		.eq('category', p.category as string)
		.order('section')
		.order('sort_order');

	if (cErr) throw error(500, cErr.message);

	// 4. Fetch all scores for these sheets
	let allScores: any[] = [];
	if (sheetIds.length > 0) {
		const { data: scores, error: scErr } = await locals.supabase
			.from('scores')
			.select('criterion_id, points, level, comment, scoresheet_id')
			.in('scoresheet_id', sheetIds);
		if (scErr) throw error(500, scErr.message);
		allScores = scores || [];
	}

	// 5. Build the report data structure
	// We want to group by section (A and B)
	const reportSections = [];

	for (const section of ['A', 'B']) {
		const sectionCriteria = (allCriteria || []).filter(c => c.section === section);
		const sheet = (sheets || []).find(s => s.section === section);
		
		const criteriaWithScores = sectionCriteria.map(c => {
			const score = allScores.find(s => s.criterion_id === c.id);
			return {
				id: c.id as string,
				name: c.name as string,
				maxPoints: c.max_points as number,
				points: score?.points as number | null,
				level: score?.level as PerfLevel | null,
				comment: score?.comment as string | null
			};
		});

		const totalScore = criteriaWithScores.reduce((sum, c) => sum + (c.points || 0), 0);
		const maxPossible = criteriaWithScores.reduce((sum, c) => sum + (c.maxPoints || 0), 0);

		reportSections.push({
			section,
			judgeName: (sheet?.profiles as any)?.full_name as string | null,
			status: sheet?.status as string | null,
			sprintTime: sheet?.live_sprint_time_seconds as number | null,
			criteria: criteriaWithScores,
			totalScore,
			maxPossible
		});
	}

	const grandTotal = reportSections.reduce((sum, s) => sum + s.totalScore, 0);
	const grandMax = reportSections.reduce((sum, s) => sum + s.maxPossible, 0);

	return {
		participant: {
			id: p.id as string,
			name: p.full_name as string,
			schoolName: (p.schools as any)?.name as string,
			category: p.category as string,
			theme: p.theme as string | null
		},
		reportSections,
		grandTotal,
		grandMax
	};
};
