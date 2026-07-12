// Scoring page server — loads the participant, the rubric for their category,
// the (possibly empty) draft scoresheet + existing scores, and exposes three
// form actions:
//
//   ?/save     idempotent autosave of any subset of criterion scores +
//              optional sprint time. Returns { saved: true, at }.
//   ?/submit   validates everything (all criteria scored, sprint time set OR
//              DQ raised) and transitions the scoresheet to status='submitted'.
//              Redirects to /judge/done/[scoresheetId].
//   ?/flagDq   inserts a disqualifications row pointing at this scoresheet.
//
// All actions create the scoresheet on demand (idempotent via the unique
// (participant_id, judge_id) index) so a judge can save a partial sheet on
// their very first interaction without an explicit "start" step.

import { error, fail, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';
import {
	sortLevels,
	deriveLevelFromPoints,
	pointsFromCheckpoints,
	type RubricCheckpoint,
	type RubricCriterion,
	type RubricLevel
} from '$lib/scoring';
import type { Category, PerfLevel } from '$lib/types';

export type ScoreRow = {
	criterionId: string;
	level: PerfLevel;
	points: number;
	comment: string | null;
	checkpointIds: string[];
};

export type DqInfo = {
	id: string;
	reason: string;
	notes: string;
	clearedBy: string | null;
	status: 'pending' | 'approved';
};

export const load: PageServerLoad = async ({ locals, params, parent, setHeaders }) => {
	const { profile } = await parent();
	const participantId = params.participantId;
	setHeaders({ 'cache-control': 'private, no-store' });

	// 1. Participant — RLS will already gate non-assigned ones for a judge.
	const { data: participant, error: pErr } = await locals.supabase
		.from('participants')
		.select('id, full_name, category, theme, school_id, qualified')
		.eq('id', participantId)
		.single();
	if (pErr || !participant) {
		throw error(404, 'Participant not found or not assigned to you.');
	}

	const { data: scratchCredentials, error: scratchError } = await locals.supabase
		.from('participant_scratch_credentials')
		.select('username, password')
		.eq('participant_id', participantId)
		.maybeSingle();
	if (scratchError) {
		throw error(500, "Could not load this participant's Scratch access details.");
	}

	const { data: school } = await locals.supabase
		.from('schools')
		.select('name, short_code')
		.eq('id', participant.school_id)
		.single();

	// 2. Rubric — criteria + their levels for this participant's category.
	//    `checkpoints` is a JSONB column that may be null (criteria still on the
	//    legacy 4-level UI) or an array (criteria converted to checklist mode).
	const { data: criteriaRows, error: cErr } = await locals.supabase
		.from('criteria')
		.select('id, category, section, name, max_points, sort_order, checkpoints')
		.eq('category', participant.category)
		.order('section', { ascending: true })
		.order('sort_order', { ascending: true });

	if (cErr || !criteriaRows) {
		throw error(500, `Failed to load rubric: ${cErr?.message ?? 'unknown'}`);
	}

	const criterionIds = criteriaRows.map((c) => c.id as string);
	const { data: levelRows } = await locals.supabase
		.from('criterion_levels')
		.select('id, criterion_id, level, min_pts, max_pts, descriptor')
		.in('criterion_id', criterionIds);

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

	const criteria: RubricCriterion[] = criteriaRows.map((c) => {
		// Guard with Array.isArray: if checkpoints is ever stored as a non-array
		// (e.g. a double-encoded JSON string), fall back to level mode rather than
		// spreading a string into characters.
		const rawCheckpoints = c.checkpoints as Array<{
			id?: string;
			sort_order?: number;
			points: number;
			label: string;
		}> | null;
		const checkpoints: RubricCheckpoint[] | undefined = Array.isArray(rawCheckpoints)
			? [...rawCheckpoints]
					.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
					// Stable fallback id. Databases seeded before checkpoints had ids
					// store id-less checkpoint objects; without a unique key the keyed
					// {#each} in CriterionCard throws each_key_duplicate and the whole
					// scoring page fails to render — which presents as the judge's
					// "Start/Continue" doing nothing. The index is unique and stable
					// (same source + same sort here and in checkpointsByCriterion), so
					// render, tick-state and server scoring all agree on the same ids.
					.map((cp, i) => ({
						id: cp.id ?? `cp-${i}`,
						sortOrder: cp.sort_order ?? i,
						points: cp.points,
						label: cp.label
					}))
			: undefined;
		return {
			id: c.id as string,
			category: c.category as Category,
			section: c.section as 'A' | 'B',
			name: c.name as string,
			maxPoints: c.max_points as number,
			sortOrder: c.sort_order as number,
			levels: sortLevels(levelsByCriterion.get(c.id as string) ?? []),
			checkpoints
		};
	});

	// 3. Existing scoresheet for THIS judge in THIS section (may be null on first
	//    visit). Now that scoresheets are section-scoped a judge can have up to
	//    TWO sheets per participant (A and B) when both assignments hit them; we
	//    pick the one matching the current event phase so the page always shows
	//    the relevant work.
	const { data: ev0 } = await locals.supabase
		.from('event_state')
		.select('phase_a, phase_b, phase_c')
		.eq('id', 1)
		.maybeSingle();

	const phaseKey = `phase_${participant.category.toLowerCase()}` as
		| 'phase_a'
		| 'phase_b'
		| 'phase_c';
	const participantPhase = ev0?.[phaseKey] ?? 'setup';
	const currentSection: 'A' | 'B' = participantPhase === 'section_b' ? 'B' : 'A';

	const { data: sheet } = await locals.supabase
		.from('scoresheets')
		.select(
			'id, status, live_sprint_time_seconds, submitted_at, finalised_at, judge_notes, section_a_submitted_at, section'
		)
		.eq('participant_id', participantId)
		.eq('judge_id', profile.id)
		.eq('section', currentSection)
		.maybeSingle();

	let scores: ScoreRow[] = [];
	let dq: DqInfo | null = null;

	// Fetch all scores for this participant across all their scoresheets (both sections).
	// This ensures Section A scores are visible to the Section B judge, and that the
	// UI knows Section A is fully scored so the final Submit button can unlock.
	// We MUST use supabaseAdmin here because RLS prevents the current judge from
	// selecting the scoresheet belonging to the other judge!
	const { data: allSheets } = await supabaseAdmin
		.from('scoresheets')
		.select('id')
		.eq('participant_id', participantId);

	const sheetIds = (allSheets ?? []).map((s) => s.id as string);
	if (sheetIds.length > 0) {
		const { data: scoreRows } = await supabaseAdmin
			.from('scores')
			.select('criterion_id, level, points, comment, checkpoint_state')
			.in('scoresheet_id', sheetIds);

		scores = (scoreRows ?? []).map((s) => ({
			criterionId: s.criterion_id as string,
			level: s.level as PerfLevel,
			points: s.points as number,
			comment: (s.comment as string | null) ?? null,
			checkpointIds: Array.isArray(s.checkpoint_state) ? (s.checkpoint_state as string[]) : []
		}));
	}

	if (sheet) {
		const { data: dqRow } = await locals.supabase
			.from('disqualifications')
			.select('id, reason, notes, cleared_by, status')
			.eq('scoresheet_id', sheet.id)
			.is('cleared_by', null)
			.in('status', ['pending', 'approved'])
			.maybeSingle();
		if (dqRow) {
			dq = {
				id: dqRow.id as string,
				reason: dqRow.reason as string,
				notes: dqRow.notes as string,
				clearedBy: (dqRow.cleared_by as string | null) ?? null,
				status: (dqRow.status as 'pending' | 'approved') ?? 'pending'
			};
		}
	}

	// 4. Event lock + phase. Judges can only edit criteria belonging to the
	//    currently-open section. Setup and finalised phases lock everything.
	const { data: ev } = await locals.supabase
		.from('event_state')
		.select('locked, phase_a, phase_b, phase_c, sprint_start_a, sprint_start_b, sprint_start_c')
		.eq('id', 1)
		.maybeSingle();
	const eventLocked = Boolean(ev?.locked);

	const participantPhaseKey = `phase_${participant.category.toLowerCase()}` as
		| 'phase_a'
		| 'phase_b'
		| 'phase_c';
	const phase = ((ev?.[participantPhaseKey] as string | null) ?? 'setup') as
		| 'setup'
		| 'section_a'
		| 'section_b'
		| 'finalised';

	const sprintStartKey = `sprint_start_${participant.category.toLowerCase()}` as
		| 'sprint_start_a'
		| 'sprint_start_b'
		| 'sprint_start_c';
	const sprintStart = (ev?.[sprintStartKey] as string | null) ?? null;

	const readOnly =
		eventLocked ||
		phase === 'setup' ||
		phase === 'finalised' ||
		sheet?.status === 'submitted' ||
		sheet?.status === 'finalised';

	return {
		participant: {
			id: participant.id as string,
			fullName: participant.full_name as string,
			category: participant.category as Category,
			theme: (participant.theme as string | null) ?? null,
			schoolName: (school?.name as string | undefined) ?? '—',
			schoolShortCode: (school?.short_code as string | null) ?? null,
			qualified: Boolean(participant.qualified)
		},
		scratchCredentials: scratchCredentials
			? {
					username: scratchCredentials.username as string,
					password: scratchCredentials.password as string
				}
			: null,
		criteria,
		scoresheet: sheet
			? {
					id: sheet.id as string,
					status: sheet.status as 'draft' | 'submitted' | 'finalised',
					liveSprintTimeSeconds: (sheet.live_sprint_time_seconds as number | null) ?? null,
					submittedAt: (sheet.submitted_at as string | null) ?? null,
					sectionASubmittedAt: (sheet.section_a_submitted_at as string | null) ?? null
				}
			: null,
		scores,
		dq,
		eventLocked,
		phase,
		sprintStart,
		readOnly,
		pendingEditRequest: sheet
			? await (async () => {
					const { data } = await locals.supabase
						.from('edit_requests')
						.select('id, reason, created_at')
						.eq('scoresheet_id', sheet.id)
						.eq('status', 'pending')
						.maybeSingle();
					return data
						? {
								id: data.id as string,
								reason: data.reason as string,
								createdAt: data.created_at as string
							}
						: null;
				})()
			: null
	};
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Find or create THIS judge's scoresheet for the given section. Scoresheets
 * are now scoped to (participant, judge, section) — see migration 022. If
 * `section` is omitted we fall back to the participant's section-A sheet so
 * legacy callers (audit / done page) still resolve to something.
 */
async function getOrCreateScoresheet(
	locals: App.Locals,
	participantId: string,
	judgeId: string,
	section: 'A' | 'B' = 'A'
): Promise<{ id: string; status: string; live_sprint_time_seconds: number | null } | null> {
	const { data: existing } = await locals.supabase
		.from('scoresheets')
		.select('id, status, live_sprint_time_seconds')
		.eq('participant_id', participantId)
		.eq('judge_id', judgeId)
		.eq('section', section)
		.maybeSingle();
	if (existing) return existing as any;

	const { data: created, error: insErr } = await locals.supabase
		.from('scoresheets')
		.insert({
			participant_id: participantId,
			judge_id: judgeId,
			section,
			status: 'draft'
		})
		.select('id, status, live_sprint_time_seconds')
		.single();
	if (insErr) return null;
	return created as any;
}

/**
 * Form-action equivalent of the layout's parent() — re-loads the requester's
 * profile and asserts the judge/super_admin role. Actions can't call parent(),
 * so we re-query.
 */
async function loadActorProfile(
	locals: App.Locals
): Promise<{ id: string; role: 'judge' | 'super_admin' }> {
	if (!locals.user) throw error(401, 'Sign in first.');
	const { data: prof } = await locals.supabase
		.from('profiles')
		.select('id, role, is_active')
		.eq('id', locals.user.id)
		.single();
	if (!prof || !prof.is_active) throw error(403, 'Profile inactive.');
	if (prof.role !== 'judge' && prof.role !== 'super_admin') {
		throw error(403, 'Only judges can score.');
	}
	return { id: prof.id as string, role: prof.role as 'judge' | 'super_admin' };
}

/** Hard cap on a single judge comment — guards against a 10MB-comment DoS. */
const MAX_COMMENT_LENGTH = 2000;

function parsePayload(form: FormData): {
	scores: Array<{
		criterionId: string;
		level: PerfLevel;
		points: number;
		comment: string | null;
		checkpointIds: string[];
	}>;
	sprintTimeSeconds: number | null | undefined;
} {
	// The form sends one `criterion_id` per card, plus per-criterion fields
	// keyed by id (`level__<id>`, `points__<id>`, `comment__<id>`,
	// `checkpoints__<id>` = JSON array of ticked checkpoint ids). We assemble
	// each tuple and drop cards that aren't fully scored yet.
	const ids = form.getAll('criterion_id').map(String);
	const scores: ReturnType<typeof parsePayload>['scores'] = [];
	const seen = new Set<string>();
	for (const id of ids) {
		if (!id || seen.has(id)) continue;
		seen.add(id);
		const lvlRaw = String(form.get(`level__${id}`) ?? '').trim();
		const ptsRaw = String(form.get(`points__${id}`) ?? '').trim();
		// Cap comment length defensively before trim() to avoid wasted CPU on
		// pathological inputs (e.g. a 50MB string of whitespace).
		const cmRawFull = String(form.get(`comment__${id}`) ?? '').slice(0, MAX_COMMENT_LENGTH);
		const cmRaw = cmRawFull.trim();
		if (lvlRaw === '' || ptsRaw === '') continue; // not scored yet
		const pts = Number(ptsRaw);
		if (!Number.isFinite(pts)) continue;

		// Checkpoint state — JSON array of ticked ids. Defensive parse: any
		// malformed value is treated as "no checkpoints ticked" rather than
		// blowing up the save. The points/level above remain canonical.
		let checkpointIds: string[] = [];
		const cpRaw = form.get(`checkpoints__${id}`);
		if (typeof cpRaw === 'string' && cpRaw.length > 0) {
			try {
				const parsed = JSON.parse(cpRaw);
				if (Array.isArray(parsed)) {
					checkpointIds = parsed.filter((v): v is string => typeof v === 'string');
				}
			} catch {
				/* ignore — keep empty */
			}
		}

		scores.push({
			criterionId: id,
			level: lvlRaw as PerfLevel,
			points: Math.round(pts),
			comment: cmRaw.length === 0 ? null : cmRaw,
			checkpointIds
		});
	}

	let sprintTimeSeconds: number | null | undefined;
	const sprintRaw = form.get('live_sprint_time_seconds');
	if (sprintRaw === null) {
		sprintTimeSeconds = undefined; // not present — don't touch it
	} else if (sprintRaw === '') {
		sprintTimeSeconds = null;
	} else {
		const n = Number(sprintRaw);
		// SECURITY: clamp to (0, 2700]. Zero is excluded because a 0-second
		// sprint would auto-win every tiebreaker. The DB CHECK constraint
		// (migration 008) enforces the same; this is the friendly app-side
		// version so the judge gets a clean validation message instead of a
		// 500 from a constraint violation.
		if (!Number.isFinite(n)) sprintTimeSeconds = null;
		else {
			const clamped = Math.min(2700, Math.floor(n));
			sprintTimeSeconds = clamped > 0 ? clamped : null;
		}
	}

	return { scores, sprintTimeSeconds };
}

// ──────────────────────────────────────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────────────────────────────────────

// Returns the current event phase, normalised. Anywhere we use it we treat
// 'setup' and 'finalised' as "no scoring allowed".
async function getPhase(
	locals: App.Locals,
	category: string
): Promise<'setup' | 'section_a' | 'section_b' | 'finalised'> {
	const { data } = await locals.supabase
		.from('event_state')
		.select('phase_a, phase_b, phase_c')
		.eq('id', 1)
		.maybeSingle();

	const phaseKey = `phase_${category.toLowerCase()}` as 'phase_a' | 'phase_b' | 'phase_c';
	const p = (data?.[phaseKey] as string | null) ?? 'setup';
	if (p === 'section_a' || p === 'section_b' || p === 'finalised') return p;
	return 'setup';
}

// Find the next participant in this judge's queue who hasn't been scored yet
// for the given phase. Returns null when the judge has finished everyone.
// Implemented as three independent queries instead of a nested embed because
// Supabase's PostgREST FK-hint syntax for reverse joins is fragile — the
// previous one-shot query was silently returning [] in some configurations,
// which meant the auto-advance always fell through to the dashboard flash.
async function nextParticipantForJudge(
	locals: App.Locals,
	judgeId: string,
	currentParticipantId: string,
	phase: 'section_a' | 'section_b'
): Promise<string | null> {
	const phaseSection: 'A' | 'B' = phase === 'section_b' ? 'B' : 'A';

	// 1. Every participant assigned to this judge IN THE CURRENT SECTION
	//    (excluding the one we just finished scoring). Multi-judge fairness
	//    means a judge's Section A queue and Section B queue can be different.
	const { data: asgns } = await locals.supabase
		.from('assignments')
		.select('participant_id')
		.eq('judge_id', judgeId)
		.eq('section', phaseSection)
		.neq('participant_id', currentParticipantId);

	const participantIds = (asgns ?? []).map((a) => a.participant_id as string);
	if (participantIds.length === 0) return null;

	// 2. This judge's section-scoped scoresheets for those participants. Empty
	//    when they haven't started a given participant yet.
	const { data: sheets } = await locals.supabase
		.from('scoresheets')
		.select('participant_id, status, section_a_submitted_at')
		.eq('judge_id', judgeId)
		.eq('section', phaseSection)
		.in('participant_id', participantIds);

	const sheetByParticipant = new Map<
		string,
		{ status: string; sectionASubmittedAt: string | null }
	>();
	for (const s of sheets ?? []) {
		sheetByParticipant.set(s.participant_id as string, {
			status: s.status as string,
			sectionASubmittedAt: s.section_a_submitted_at as string | null
		});
	}

	// 3. Participant names — for predictable alphabetical ordering.
	const { data: parts } = await locals.supabase
		.from('participants')
		.select('id, full_name')
		.in('id', participantIds);

	const nameById = new Map<string, string>();
	for (const p of parts ?? []) {
		nameById.set(p.id as string, (p.full_name as string) ?? '');
	}

	// A section is "done for this judge" when the section sheet exists and is
	// submitted/finalised. For Section A, we also consider it done if section_a_submitted_at is set.
	const candidates = participantIds
		.filter((id) => {
			const sheet = sheetByParticipant.get(id);
			if (!sheet) return true;
			if (sheet.status === 'submitted' || sheet.status === 'finalised') return false;
			if (phase === 'section_a' && sheet.sectionASubmittedAt) return false;
			return true;
		})
		.sort((a, b) => (nameById.get(a) ?? '').localeCompare(nameById.get(b) ?? ''));

	return candidates[0] ?? null;
}

// Returns the set of criterion ids that belong to a given section, scoped to
// the participant's category. Used to reject scores for the wrong phase.
async function criterionIdsForSection(
	locals: App.Locals,
	participantId: string,
	section: 'A' | 'B'
): Promise<Set<string>> {
	const { data: p } = await locals.supabase
		.from('participants')
		.select('category')
		.eq('id', participantId)
		.maybeSingle();
	if (!p) return new Set();
	const { data } = await locals.supabase
		.from('criteria')
		.select('id')
		.eq('category', p.category as string)
		.eq('section', section);
	return new Set((data ?? []).map((c) => c.id as string));
}

// Returns a map criterion_id → checkpoints for the participant's category.
// Empty list when the criterion is still on the legacy 4-level UI.
async function checkpointsByCriterion(
	locals: App.Locals,
	participantId: string
): Promise<Map<string, RubricCheckpoint[]>> {
	const { data: p } = await locals.supabase
		.from('participants')
		.select('category')
		.eq('id', participantId)
		.maybeSingle();
	if (!p) return new Map();
	const { data } = await locals.supabase
		.from('criteria')
		.select('id, max_points, checkpoints')
		.eq('category', p.category as string);
	const out = new Map<string, RubricCheckpoint[]>();
	for (const c of data ?? []) {
		const raw = c.checkpoints as Array<{
			id?: string;
			sort_order?: number;
			points: number;
			label: string;
		}> | null;
		if (!Array.isArray(raw)) {
			out.set(c.id as string, []);
			continue;
		}
		out.set(
			c.id as string,
			[...raw]
				.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
				// Same stable fallback id as the page-load mapping above, so the
				// server's checkpoint→points reconciliation matches the ids the
				// client ticked even when the stored checkpoints have no id.
				.map((cp, i) => ({
					id: cp.id ?? `cp-${i}`,
					sortOrder: cp.sort_order ?? i,
					points: cp.points,
					label: cp.label
				}))
		);
	}
	return out;
}

/**
 * For a single parsed score row, recompute canonical (level, points) from the
 * ticked checkpoints when the criterion has any. Mutates a copy and returns it.
 * Falls through unchanged if the criterion is still on the legacy level UI.
 * SECURITY: prevents a tampered form from submitting (level=Excellent, points=999)
 * without the supporting ticks; the server always wins.
 */
function reconcileWithCheckpoints(
	row: { criterionId: string; level: PerfLevel; points: number; checkpointIds: string[] },
	checkpoints: RubricCheckpoint[] | undefined,
	maxPoints: number
): { level: PerfLevel; points: number } {
	if (!checkpoints || checkpoints.length === 0) {
		return { level: row.level, points: row.points };
	}
	const ticked = new Set(row.checkpointIds);
	const points = pointsFromCheckpoints(checkpoints, ticked);
	const clamped = Math.max(0, Math.min(maxPoints, points));
	return { level: deriveLevelFromPoints(clamped, maxPoints), points: clamped };
}

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		// We need the participant's category to determine their phase
		const { data: participant } = await locals.supabase
			.from('participants')
			.select('category')
			.eq('id', params.participantId)
			.single();
		if (!participant) return fail(404, { saveError: 'Participant not found.' });

		const phase = await getPhase(locals, participant.category);
		if (phase === 'setup' || phase === 'finalised') {
			return fail(409, {
				saveError:
					phase === 'setup'
						? 'Scoring has not opened yet. Wait for the admin to open Section A.'
						: 'Scoring is finalised. No further changes allowed.'
			});
		}

		const currentSection: 'A' | 'B' = phase === 'section_b' ? 'B' : 'A';
		const sheet = await getOrCreateScoresheet(
			locals,
			params.participantId,
			profile.id,
			currentSection
		);
		if (!sheet) {
			return fail(500, { saveError: 'Could not create or load scoresheet.' });
		}
		if (sheet.status !== 'draft') {
			return fail(409, { saveError: 'Scoresheet is locked (already submitted).' });
		}

		// Per-judge Section A soft-lock: once they've submitted Section A,
		// they can't keep editing it even though the event is still in
		// section_a phase.
		const { data: sheetState } = await locals.supabase
			.from('scoresheets')
			.select('section_a_submitted_at')
			.eq('id', sheet.id)
			.maybeSingle();
		const judgeSubmittedA = !!sheetState?.section_a_submitted_at;
		if (phase === 'section_a' && judgeSubmittedA) {
			return fail(409, {
				saveError:
					"You've already submitted Section A. Ask the admin to unlock if you need to change something."
			});
		}

		const form = await request.formData();
		const { scores, sprintTimeSeconds } = parsePayload(form);

		// `currentSection` is already in scope from the getOrCreateScoresheet
		// call above. Use it to reject scores belonging to a section other than
		// the current phase's.
		const allowedIds = await criterionIdsForSection(locals, params.participantId, currentSection);
		const inPhaseScores = scores.filter((s) => allowedIds.has(s.criterionId));

		if (inPhaseScores.length > 0) {
			// Reconcile points/level from checkpoint state on the server so a
			// tampered client can't smuggle in an inconsistent score.
			const cpByCriterion = await checkpointsByCriterion(locals, params.participantId);
			const { data: critRows } = await locals.supabase
				.from('criteria')
				.select('id, max_points')
				.in(
					'id',
					inPhaseScores.map((s) => s.criterionId)
				);
			const maxByCrit = new Map<string, number>(
				(critRows ?? []).map((r) => [r.id as string, r.max_points as number])
			);

			const rows = inPhaseScores.map((s) => {
				const reconciled = reconcileWithCheckpoints(
					s,
					cpByCriterion.get(s.criterionId),
					maxByCrit.get(s.criterionId) ?? s.points
				);
				return {
					scoresheet_id: sheet.id,
					criterion_id: s.criterionId,
					level: reconciled.level,
					points: reconciled.points,
					comment: s.comment,
					checkpoint_state: s.checkpointIds.length > 0 ? s.checkpointIds : null
				};
			});
			const { error: upErr } = await locals.supabase
				.from('scores')
				.upsert(rows, { onConflict: 'scoresheet_id,criterion_id' });
			if (upErr) {
				return fail(400, { saveError: upErr.message });
			}
		}

		// Sprint time is a Section B concept (event-day metric).
		if (sprintTimeSeconds !== undefined && phase === 'section_b') {
			const { error: stErr } = await locals.supabase
				.from('scoresheets')
				.update({ live_sprint_time_seconds: sprintTimeSeconds })
				.eq('id', sheet.id);
			if (stErr) {
				return fail(400, { saveError: stErr.message });
			}
		}

		return {
			saved: true,
			at: new Date().toISOString(),
			scoresheetId: sheet.id
		};
	},

	submit: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		const { data: participant } = await locals.supabase
			.from('participants')
			.select('category')
			.eq('id', params.participantId)
			.single();
		if (!participant) return fail(404, { submitError: 'Participant not found.' });

		const phase = await getPhase(locals, participant.category);

		if (phase !== 'section_a' && phase !== 'section_b') {
			return fail(409, {
				submitError:
					phase === 'finalised'
						? 'Scoring is finalised. No further changes allowed.'
						: 'Scoring has not opened yet.'
			});
		}

		const form = await request.formData();
		const { scores, sprintTimeSeconds } = parsePayload(form);

		const submitSection: 'A' | 'B' = phase === 'section_b' ? 'B' : 'A';
		const sheet = await getOrCreateScoresheet(
			locals,
			params.participantId,
			profile.id,
			submitSection
		);
		if (!sheet) {
			return fail(500, { submitError: 'Could not load scoresheet.' });
		}
		if (sheet.status !== 'draft') {
			return fail(409, { submitError: 'Scoresheet already submitted.' });
		}

		// Which section is this submission for? Determined by the current phase.
		const currentSection: 'A' | 'B' = phase === 'section_a' ? 'A' : 'B';
		const sectionIds = await criterionIdsForSection(locals, params.participantId, currentSection);
		const scoresToUpsert = scores.filter((s) => sectionIds.has(s.criterionId));

		// SECTION A submit path: re-save section A scores, validate complete,
		// stamp section_a_submitted_at, then return success (no redirect — the
		// judge stays on the page in a "Section A submitted" read-only state).
		if (phase === 'section_a') {
			// Block re-submission if section A was already marked done.
			const { data: sheetState } = await locals.supabase
				.from('scoresheets')
				.select('section_a_submitted_at')
				.eq('id', sheet.id)
				.maybeSingle();
			if (sheetState?.section_a_submitted_at) {
				return fail(409, {
					submitError:
						'Section A is already submitted. Ask the admin to unlock if you need to change something.'
				});
			}

			if (scoresToUpsert.length > 0) {
				const cpByCriterion = await checkpointsByCriterion(locals, params.participantId);
				const { data: critRows } = await locals.supabase
					.from('criteria')
					.select('id, max_points')
					.in(
						'id',
						scoresToUpsert.map((s) => s.criterionId)
					);
				const maxByCrit = new Map<string, number>(
					(critRows ?? []).map((r) => [r.id as string, r.max_points as number])
				);
				const { error: upErr } = await locals.supabase.from('scores').upsert(
					scoresToUpsert.map((s) => {
						const reconciled = reconcileWithCheckpoints(
							s,
							cpByCriterion.get(s.criterionId),
							maxByCrit.get(s.criterionId) ?? s.points
						);
						return {
							scoresheet_id: sheet.id,
							criterion_id: s.criterionId,
							level: reconciled.level,
							points: reconciled.points,
							comment: s.comment,
							checkpoint_state: s.checkpointIds.length > 0 ? s.checkpointIds : null
						};
					}),
					{ onConflict: 'scoresheet_id,criterion_id' }
				);
				if (upErr) return fail(400, { submitError: upErr.message });
			}

			// Confirm every Section A criterion has a score.
			const { data: scoreRows } = await locals.supabase
				.from('scores')
				.select('criterion_id')
				.eq('scoresheet_id', sheet.id);
			const scored = new Set((scoreRows ?? []).map((r) => r.criterion_id as string));
			const missing = [...sectionIds].filter((id) => !scored.has(id));
			if (missing.length > 0) {
				return fail(400, {
					submitError: `Score every Section A criterion before submitting (${
						sectionIds.size - missing.length
					} / ${sectionIds.size} done).`
				});
			}

			const { error: stampErr } = await locals.supabase
				.from('scoresheets')
				.update({
					section_a_submitted_at: new Date().toISOString(),
					status: 'submitted'
				})
				.eq('id', sheet.id);
			if (stampErr) return fail(400, { submitError: stampErr.message });

			// Jump straight to the next Section-A-unfinished participant if there
			// is one. If they've finished their queue, drop them back at /judge
			// with a flash message.
			const next = await nextParticipantForJudge(
				locals,
				profile.id,
				params.participantId,
				'section_a'
			);
			if (next) throw redirect(303, `/judge/score/${next}`);
			throw redirect(303, '/judge?flash=section_a_complete');
		}

		// SECTION B submit path — the original "final submission" flow.
		if (scoresToUpsert.length > 0) {
			const cpByCriterion = await checkpointsByCriterion(locals, params.participantId);
			const { data: critRows } = await locals.supabase
				.from('criteria')
				.select('id, max_points')
				.in(
					'id',
					scoresToUpsert.map((s) => s.criterionId)
				);
			const maxByCrit = new Map<string, number>(
				(critRows ?? []).map((r) => [r.id as string, r.max_points as number])
			);
			const { error: upErr } = await locals.supabase.from('scores').upsert(
				scoresToUpsert.map((s) => {
					const reconciled = reconcileWithCheckpoints(
						s,
						cpByCriterion.get(s.criterionId),
						maxByCrit.get(s.criterionId) ?? s.points
					);
					return {
						scoresheet_id: sheet.id,
						criterion_id: s.criterionId,
						level: reconciled.level,
						points: reconciled.points,
						comment: s.comment,
						checkpoint_state: s.checkpointIds.length > 0 ? s.checkpointIds : null
					};
				}),
				{ onConflict: 'scoresheet_id,criterion_id' }
			);
			if (upErr) return fail(400, { submitError: upErr.message });
		}

		if (sprintTimeSeconds !== undefined) {
			await locals.supabase
				.from('scoresheets')
				.update({ live_sprint_time_seconds: sprintTimeSeconds })
				.eq('id', sheet.id);
		}

		// Validate before flipping status.
		const { data: criteriaCount } = await locals.supabase
			.from('criteria')
			.select('id', { count: 'exact', head: true })
			.eq(
				'category',
				(
					await locals.supabase
						.from('participants')
						.select('category')
						.eq('id', params.participantId)
						.single()
				).data?.category
			);
		const totalCriteria = (criteriaCount as unknown as { count?: number })?.count ?? 0;

		const { data: scoreRows } = await locals.supabase
			.from('scores')
			.select('criterion_id, level, points')
			.eq('scoresheet_id', sheet.id);
		const scoredCount = scoreRows?.length ?? 0;

		if (totalCriteria > 0 && scoredCount < totalCriteria) {
			return fail(400, {
				submitError: `All criteria must be scored (${scoredCount} / ${totalCriteria}).`
			});
		}

		const { data: dqRow } = await locals.supabase
			.from('disqualifications')
			.select('id')
			.eq('scoresheet_id', sheet.id)
			.is('cleared_by', null)
			.in('status', ['pending', 'approved'])
			.maybeSingle();

		const { data: latestSheet } = await locals.supabase
			.from('scoresheets')
			.select('live_sprint_time_seconds')
			.eq('id', sheet.id)
			.single();

		const sprintOk =
			latestSheet?.live_sprint_time_seconds !== null &&
			latestSheet?.live_sprint_time_seconds !== undefined;
		if (!sprintOk && !dqRow) {
			return fail(400, {
				submitError:
					'Enter sprint time (mm:ss) or raise a disqualification request before submitting.'
			});
		}

		const { error: upStatusErr } = await locals.supabase
			.from('scoresheets')
			.update({ status: 'submitted', submitted_at: new Date().toISOString() })
			.eq('id', sheet.id);
		if (upStatusErr) return fail(400, { submitError: upStatusErr.message });

		// Auto-advance to the next unfinished participant. Judges asked for
		// this — they don't want a recap page in between. /judge/done is still
		// reachable directly (e.g. via the audit log) but isn't on the main
		// flow anymore.
		const next = await nextParticipantForJudge(
			locals,
			profile.id,
			params.participantId,
			'section_b'
		);
		if (next) throw redirect(303, `/judge/score/${next}`);
		throw redirect(303, '/judge?flash=all_done');
	},

	requestEdit: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		const { data: sheet } = await locals.supabase
			.from('scoresheets')
			.select('id, status, section_a_submitted_at')
			.eq('participant_id', params.participantId)
			.eq('judge_id', profile.id)
			.maybeSingle();
		if (!sheet) {
			return fail(404, { requestError: 'No scoresheet to request edit on.' });
		}
		// Only meaningful when something IS locked.
		const isLocked =
			sheet.status === 'submitted' ||
			sheet.status === 'finalised' ||
			!!sheet.section_a_submitted_at;
		if (!isLocked) {
			return fail(409, { requestError: 'Scoresheet is not locked — no need to request edit.' });
		}

		const form = await request.formData();
		const reason = String(form.get('reason') ?? '')
			.trim()
			.slice(0, 1000);
		if (reason.length < 10) {
			return fail(400, {
				requestError: 'Tell the admin in at least 10 characters what you need to change.'
			});
		}

		// Block duplicate pending requests. The DB has a partial unique index
		// (one pending per scoresheet) so this is also a hard guarantee.
		const { data: existing } = await locals.supabase
			.from('edit_requests')
			.select('id')
			.eq('scoresheet_id', sheet.id)
			.eq('status', 'pending')
			.maybeSingle();
		if (existing) {
			return fail(409, {
				requestError: 'A request is already pending for this scoresheet. Wait for the admin.'
			});
		}

		const { error: insErr } = await locals.supabase
			.from('edit_requests')
			.insert({ scoresheet_id: sheet.id, requested_by: profile.id, reason });
		if (insErr) return fail(400, { requestError: insErr.message });

		return { requestSent: true };
	},

	// Renamed from "flag DQ" → "request disqualification" because every
	// request is now pending until super_admin reviews. The participant
	// stays qualified until approval.
	flagDq: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		const { data: participant } = await locals.supabase
			.from('participants')
			.select('category')
			.eq('id', params.participantId)
			.single();
		if (!participant) return fail(404, { error: 'Participant not found.' });

		// DQ requests target the scoresheet that's CURRENTLY in front of the
		// judge — i.e. the current phase's section.
		const phase = await getPhase(locals, participant.category);
		const dqSection: 'A' | 'B' = phase === 'section_b' ? 'B' : 'A';
		const sheet = await getOrCreateScoresheet(locals, params.participantId, profile.id, dqSection);
		if (!sheet) return fail(500, { dqError: 'Could not load scoresheet.' });

		const form = await request.formData();
		const reason = String(form.get('reason') ?? '').trim();
		// SECURITY: cap before trim to bound work on pathological input.
		const notes = String(form.get('notes') ?? '')
			.slice(0, MAX_COMMENT_LENGTH)
			.trim();

		const allowed = [
			'complete_on_arrival',
			'tutorial_or_ai_use',
			'parental_assistance',
			'unsportsmanlike_conduct',
			'other'
		];
		if (!allowed.includes(reason)) {
			return fail(400, { dqError: 'Pick a valid reason.' });
		}
		// Require a substantive note. Every disqualification is consequential
		// — the note must read like a sentence the admin can act on.
		if (notes.length < 10) {
			return fail(400, {
				dqError: 'Disqualification note must be at least 10 characters explaining what happened.'
			});
		}

		// Reuse a still-pending request from this judge if one exists. Only
		// counts as "still active" if it isn't denied and isn't cleared.
		const { data: existing } = await locals.supabase
			.from('disqualifications')
			.select('id, status')
			.eq('scoresheet_id', sheet.id)
			.is('cleared_by', null)
			.maybeSingle();

		if (existing && existing.status !== 'denied') {
			const { error: upErr } = await locals.supabase
				.from('disqualifications')
				.update({ reason, notes, status: 'pending' })
				.eq('id', existing.id);
			if (upErr) return fail(400, { dqError: upErr.message });
		} else {
			const { error: insErr } = await locals.supabase.from('disqualifications').insert({
				scoresheet_id: sheet.id,
				reason,
				notes,
				raised_by: profile.id,
				status: 'pending'
			});
			if (insErr) return fail(400, { dqError: insErr.message });
		}

		return { dqRaised: true };
	}
};
