import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchRankings } from '$lib/results/query';
import { EVENT_CATEGORIES } from '$lib/event-status';
import type { Category } from '$lib/types';

const NO_FILTERS = { categories: [], themes: [], schools: [], statuses: [] };

export type ViewerLeader = {
	participantId: string;
	participantName: string;
	schoolName: string;
	totalPoints: number;
	liveSprintTimeSeconds: number | null;
	rank: number | null;
};

export type ViewerCategoryOverview = {
	qualified: number;
	submittedA: number;
	submittedB: number;
	leaders: ViewerLeader[];
};

function emptyOverview(): ViewerCategoryOverview {
	return { qualified: 0, submittedA: 0, submittedB: 0, leaders: [] };
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	await parent();
	const [rankResult, participantsResult, sheetsResult] = await Promise.all([
		fetchRankings(locals.supabase, NO_FILTERS),
		locals.supabase.from('participants').select('id, category, qualified'),
		locals.supabase
			.from('scoresheets')
			.select('participant_id, section, status')
			.in('status', ['submitted', 'finalised'])
	]);

	if (participantsResult.error) throw error(500, participantsResult.error.message);
	if (sheetsResult.error) throw error(500, sheetsResult.error.message);

	const categories: Record<Category, ViewerCategoryOverview> = {
		A: emptyOverview(),
		B: emptyOverview(),
		C: emptyOverview()
	};
	const participantCategory = new Map<string, Category>();
	for (const participant of participantsResult.data ?? []) {
		const category = participant.category as Category;
		participantCategory.set(participant.id as string, category);
		if (participant.qualified) categories[category].qualified += 1;
	}

	const submitted = new Set<string>();
	for (const sheet of sheetsResult.data ?? []) {
		const participantId = sheet.participant_id as string;
		const category = participantCategory.get(participantId);
		if (!category) continue;
		const section = sheet.section as 'A' | 'B';
		const key = `${participantId}:${section}`;
		if (submitted.has(key)) continue;
		submitted.add(key);
		categories[category][section === 'A' ? 'submittedA' : 'submittedB'] += 1;
	}

	for (const category of EVENT_CATEGORIES) {
		categories[category].leaders = rankResult.rows
			.filter((row) => row.category === category && row.totalPoints !== null && row.rank !== null)
			.slice(0, 3)
			.map((row) => ({
				participantId: row.participantId,
				participantName: row.participantName,
				schoolName: row.schoolName,
				totalPoints: row.totalPoints!,
				liveSprintTimeSeconds: row.liveSprintTimeSeconds,
				rank: row.rank
			}));
	}

	const overall = EVENT_CATEGORIES.reduce(
		(acc, category) => {
			const item = categories[category];
			acc.qualified += item.qualified;
			acc.completedSections += item.submittedA + item.submittedB;
			return acc;
		},
		{ qualified: 0, completedSections: 0 }
	);

	return {
		categories,
		overall,
		loadError: rankResult.error,
		refreshedAt: new Date().toISOString()
	};
};
