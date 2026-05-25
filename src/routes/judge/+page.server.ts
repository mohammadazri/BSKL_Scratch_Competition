// Judge queue loader — reads the `judge_queue` view (one row per assigned
// participant) and shapes it for the dashboard.
//
// RLS guarantees this judge only sees their own rows; super_admin sees all
// rows in the view but for /judge we filter by their id so the UI shows
// participants assigned to them specifically.

import type { PageServerLoad } from './$types';

export type QueueRow = {
	participantId: string;
	scoresheetId: string | null;
	fullName: string;
	category: 'A' | 'B' | 'C';
	schoolName: string;
	theme: string | null;
	status: 'not_started' | 'draft' | 'submitted' | 'finalised';
	scoredCount: number;
	totalCount: number;
};

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { profile } = await parent();

	const { data, error: qErr } = await locals.supabase
		.from('judge_queue')
		.select(
			'participant_id, scoresheet_id, full_name, category, school_name, theme, status, scored_criteria_count, total_criteria_count'
		)
		.eq('judge_id', profile.id);

	if (qErr) {
		return { rows: [] as QueueRow[], loadError: qErr.message };
	}

	const rows: QueueRow[] = (data ?? []).map((r) => ({
		participantId: r.participant_id as string,
		scoresheetId: (r.scoresheet_id as string | null) ?? null,
		fullName: r.full_name as string,
		category: r.category as 'A' | 'B' | 'C',
		schoolName: r.school_name as string,
		theme: (r.theme as string | null) ?? null,
		// If there's no scoresheet yet, treat status as "not started".
		status: r.scoresheet_id
			? (r.status as 'draft' | 'submitted' | 'finalised')
			: 'not_started',
		scoredCount: Number(r.scored_criteria_count ?? 0),
		totalCount: Number(r.total_criteria_count ?? 0)
	}));

	// Sort: not_started → draft → submitted → finalised, then by name.
	const statusOrder: Record<QueueRow['status'], number> = {
		not_started: 0,
		draft: 1,
		submitted: 2,
		finalised: 3
	};
	rows.sort((a, b) => {
		const s = statusOrder[a.status] - statusOrder[b.status];
		if (s !== 0) return s;
		return a.fullName.localeCompare(b.fullName);
	});

	return { rows, loadError: null as string | null };
};
