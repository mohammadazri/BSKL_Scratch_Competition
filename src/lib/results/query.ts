// Server-side data access for the results / leaderboard pages.
//
// Single source of truth for both /admin/results and /viewer/results.
// Both pages render the same data; the only role-aware bit is which mutation
// buttons render in the UI (handled in the components, not here).
//
// IMPORTANT: trust the `final_rankings` view (SCHEMA.md § views) — it does the
// tiebreak ordering and RANK() window. We don't re-rank or re-sort in JS.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankingRow, ResultsFilters } from './types';
import type { Category, Theme, ScoresheetStatus } from '$lib/types';

const ALL_CATEGORIES: Category[] = ['A', 'B', 'C'];
const ALL_THEMES: Theme[] = ['Eco-Warriors', 'Smart Cities', 'Space Pioneers'];
const ALL_STATUSES: (ScoresheetStatus | 'not_started')[] = [
	'not_started',
	'draft',
	'submitted',
	'finalised'
];

/** Pull filter values from URL search params. Empty array = "all". */
export function parseResultsFilters(params: URLSearchParams): ResultsFilters {
	const csv = (key: string) =>
		(params.get(key) ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

	const categories = csv('category').filter((c): c is Category =>
		(ALL_CATEGORIES as string[]).includes(c)
	);
	const themes = csv('theme').filter(
		(t): t is Theme | 'none' => t === 'none' || (ALL_THEMES as string[]).includes(t)
	);
	const schools = csv('school');
	const statuses = csv('status').filter((s): s is ScoresheetStatus | 'not_started' =>
		(ALL_STATUSES as string[]).includes(s)
	);

	return { categories, themes, schools, statuses };
}

/** Serialise filters back to a URLSearchParams (for export links etc.). */
export function serializeResultsFilters(f: ResultsFilters): URLSearchParams {
	const out = new URLSearchParams();
	if (f.categories.length) out.set('category', f.categories.join(','));
	if (f.themes.length) out.set('theme', f.themes.join(','));
	if (f.schools.length) out.set('school', f.schools.join(','));
	if (f.statuses.length) out.set('status', f.statuses.join(','));
	return out;
}

/** Build a query against final_rankings + decorate with scoresheet status, override, judge. */
export async function fetchRankings(
	supabase: SupabaseClient,
	f: ResultsFilters
): Promise<{ rows: RankingRow[]; error: string | null }> {
	// 1. final_rankings — DB returns rows already ordered by category, rank.
	let q: any = supabase
		.from('final_rankings')
		.select(
			'participant_id, participant_name, school_name, category, theme, qualified, total_points, live_sprint_time_seconds, submitted_at, judge_id, rank'
		);
	if (f.categories.length) q = q.in('category', f.categories);
	// Theme filter — `'none'` means NULL theme. Mix-and-match supported.
	if (f.themes.length) {
		const hasNone = f.themes.includes('none');
		const realThemes = f.themes.filter((t) => t !== 'none');
		if (hasNone && realThemes.length) {
			q = q.or(`theme.is.null,theme.in.(${realThemes.join(',')})`);
		} else if (hasNone) {
			q = q.is('theme', null);
		} else {
			q = q.in('theme', realThemes);
		}
	}
	if (f.schools.length) {
		// final_rankings exposes school_name, not school_id — convert ids → names.
		const { data: schools } = await supabase
			.from('schools')
			.select('id, name')
			.in('id', f.schools);
		const names = (schools ?? []).map((s: any) => s.name);
		if (names.length === 0) return { rows: [], error: null };
		q = q.in('school_name', names);
	}

	const { data: rankings, error: rErr } = await q
		.order('category', { ascending: true })
		.order('rank', { ascending: true, nullsFirst: false });
	if (rErr) return { rows: [], error: rErr.message };

	const participantIds = (rankings ?? []).map((r: any) => r.participant_id as string);
	if (participantIds.length === 0) {
		return { rows: [], error: null };
	}

	// 2. Decorate with scoresheet info — status + scoresheet_id + override flag.
	//    final_rankings includes only submitted/finalised, but participants without
	//    a submitted sheet still appear (with null totals). We look up the latest
	//    sheet per participant to surface "draft" / "not_started" status accurately.
	const { data: sheets, error: sErr } = await supabase
		.from('scoresheets')
		.select('id, participant_id, status, judge_id')
		.in('participant_id', participantIds);
	if (sErr) return { rows: [], error: sErr.message };

	const sheetByParticipant = new Map<
		string,
		{ id: string; status: ScoresheetStatus; judgeId: string }
	>();
	for (const s of sheets ?? []) {
		const pid = s.participant_id as string;
		// Prefer submitted/finalised over draft if multiple exist (rare).
		const existing = sheetByParticipant.get(pid);
		const sStatus = s.status as ScoresheetStatus;
		if (!existing || sStatus !== 'draft') {
			sheetByParticipant.set(pid, {
				id: s.id as string,
				status: sStatus,
				judgeId: s.judge_id as string
			});
		}
	}

	// 3. Override flag — any score row with is_override = true for these sheets.
	const sheetIds = Array.from(sheetByParticipant.values()).map((s) => s.id);
	const overrideSet = new Set<string>();
	if (sheetIds.length) {
		const { data: overrides } = await supabase
			.from('scores')
			.select('scoresheet_id')
			.in('scoresheet_id', sheetIds)
			.eq('is_override', true);
		for (const o of overrides ?? []) overrideSet.add(o.scoresheet_id as string);
	}

	// 4. Judge profile lookup for display name + email.
	const judgeIds = Array.from(
		new Set(
			(rankings ?? [])
				.map((r: any) => r.judge_id as string | null)
				.filter((id: string | null): id is string => !!id)
		)
	);
	const judgeMap = new Map<string, { name: string; email: string }>();
	if (judgeIds.length) {
		const { data: judges } = await supabase
			.from('profiles')
			.select('id, full_name, email')
			.in('id', judgeIds);
		for (const j of judges ?? []) {
			judgeMap.set(j.id as string, {
				name: j.full_name as string,
				email: j.email as string
			});
		}
	}

	// 5. Tie detection — count rows sharing (category, rank).
	const rankCounts = new Map<string, number>();
	for (const r of rankings ?? []) {
		if (r.rank == null) continue;
		const key = `${r.category}:${r.rank}`;
		rankCounts.set(key, (rankCounts.get(key) ?? 0) + 1);
	}

	const out: RankingRow[] = (rankings ?? []).map((r: any) => {
		const pid = r.participant_id as string;
		const sheet = sheetByParticipant.get(pid) ?? null;
		const judgeId = (r.judge_id as string | null) ?? sheet?.judgeId ?? null;
		const judge = judgeId ? (judgeMap.get(judgeId) ?? null) : null;
		const status: ScoresheetStatus | 'not_started' = sheet
			? sheet.status
			: 'not_started';
		const rankKey = r.rank != null ? `${r.category}:${r.rank}` : null;
		const isTied = !!(rankKey && (rankCounts.get(rankKey) ?? 0) > 1);

		return {
			participantId: pid,
			participantName: r.participant_name as string,
			schoolName: r.school_name as string,
			category: r.category as Category,
			theme: (r.theme as Theme | null) ?? null,
			qualified: Boolean(r.qualified ?? true),
			totalPoints: (r.total_points as number | null) ?? null,
			liveSprintTimeSeconds: (r.live_sprint_time_seconds as number | null) ?? null,
			submittedAt: (r.submitted_at as string | null) ?? null,
			judgeId,
			judgeName: judge?.name ?? null,
			judgeEmail: judge?.email ?? null,
			rank: (r.rank as number | null) ?? null,
			scoresheetId: sheet?.id ?? null,
			scoresheetStatus: status,
			hasOverride: !!(sheet && overrideSet.has(sheet.id)),
			isTied
		};
	});

	// 6. Apply the status filter client-side (final_rankings doesn't expose it).
	const filtered = f.statuses.length
		? out.filter((r) => f.statuses.includes(r.scoresheetStatus))
		: out;

	return { rows: filtered, error: null };
}

/** Pull the list of schools that have at least one ranked participant. */
export async function fetchSchoolOptions(
	supabase: SupabaseClient
): Promise<{ id: string; name: string }[]> {
	const { data } = await supabase
		.from('schools')
		.select('id, name')
		.order('name', { ascending: true });
	return (data ?? []).map((s: any) => ({ id: s.id as string, name: s.name as string }));
}

/** Aggregate counters shown in the footer. */
export function computeTotals(rows: RankingRow[]): {
	scored: number;
	pending: number;
	tiesBrokenByTime: number;
} {
	let scored = 0;
	let pending = 0;
	for (const r of rows) {
		if (
			r.scoresheetStatus === 'submitted' ||
			r.scoresheetStatus === 'finalised'
		) {
			scored += 1;
		} else {
			pending += 1;
		}
	}
	// Tiebreaks: count tied groups where there's at least one row tied with the
	// next on score but distinct on sprint time. We approximate by counting tied
	// pairs.
	let tiesBrokenByTime = 0;
	const byCatRank = new Map<string, RankingRow[]>();
	for (const r of rows) {
		if (r.rank == null) continue;
		const key = `${r.category}:${r.rank}`;
		const arr = byCatRank.get(key) ?? [];
		arr.push(r);
		byCatRank.set(key, arr);
	}
	for (const arr of byCatRank.values()) {
		if (arr.length > 1) tiesBrokenByTime += arr.length - 1;
	}
	return { scored, pending, tiesBrokenByTime };
}
