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
import type { Actions, PageServerLoad } from './$types';
import { sortLevels, type RubricCriterion, type RubricLevel } from '$lib/scoring';
import type { Category, PerfLevel } from '$lib/types';

export type ScoreRow = {
	criterionId: string;
	level: PerfLevel;
	points: number;
	comment: string | null;
};

export type DqInfo = {
	id: string;
	reason: string;
	notes: string;
	clearedBy: string | null;
};

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	const { profile } = await parent();
	const participantId = params.participantId;

	// 1. Participant — RLS will already gate non-assigned ones for a judge.
	const { data: participant, error: pErr } = await locals.supabase
		.from('participants')
		.select('id, full_name, category, theme, school_id, qualified')
		.eq('id', participantId)
		.single();
	if (pErr || !participant) {
		throw error(404, 'Participant not found or not assigned to you.');
	}

	const { data: school } = await locals.supabase
		.from('schools')
		.select('name, short_code')
		.eq('id', participant.school_id)
		.single();

	// 2. Rubric — criteria + their levels for this participant's category.
	const { data: criteriaRows, error: cErr } = await locals.supabase
		.from('criteria')
		.select('id, category, section, name, max_points, sort_order')
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

	const criteria: RubricCriterion[] = criteriaRows.map((c) => ({
		id: c.id as string,
		category: c.category as Category,
		section: c.section as 'A' | 'B',
		name: c.name as string,
		maxPoints: c.max_points as number,
		sortOrder: c.sort_order as number,
		levels: sortLevels(levelsByCriterion.get(c.id as string) ?? [])
	}));

	// 3. Existing scoresheet (may be null on first visit).
	const { data: sheet } = await locals.supabase
		.from('scoresheets')
		.select(
			'id, status, live_sprint_time_seconds, submitted_at, finalised_at, judge_notes'
		)
		.eq('participant_id', participantId)
		.eq('judge_id', profile.id)
		.maybeSingle();

	let scores: ScoreRow[] = [];
	let dq: DqInfo | null = null;
	if (sheet) {
		const { data: scoreRows } = await locals.supabase
			.from('scores')
			.select('criterion_id, level, points, comment')
			.eq('scoresheet_id', sheet.id);
		scores = (scoreRows ?? []).map((s) => ({
			criterionId: s.criterion_id as string,
			level: s.level as PerfLevel,
			points: s.points as number,
			comment: (s.comment as string | null) ?? null
		}));

		const { data: dqRow } = await locals.supabase
			.from('disqualifications')
			.select('id, reason, notes, cleared_by')
			.eq('scoresheet_id', sheet.id)
			.is('cleared_by', null)
			.maybeSingle();
		if (dqRow) {
			dq = {
				id: dqRow.id as string,
				reason: dqRow.reason as string,
				notes: dqRow.notes as string,
				clearedBy: (dqRow.cleared_by as string | null) ?? null
			};
		}
	}

	// 4. Event lock — judges can't edit when the super_admin has locked the event.
	const { data: ev } = await locals.supabase
		.from('event_state')
		.select('locked')
		.eq('id', 1)
		.maybeSingle();
	const eventLocked = Boolean(ev?.locked);

	const readOnly =
		eventLocked ||
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
		criteria,
		scoresheet: sheet
			? {
					id: sheet.id as string,
					status: sheet.status as 'draft' | 'submitted' | 'finalised',
					liveSprintTimeSeconds: (sheet.live_sprint_time_seconds as number | null) ?? null,
					submittedAt: (sheet.submitted_at as string | null) ?? null
				}
			: null,
		scores,
		dq,
		eventLocked,
		readOnly
	};
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function getOrCreateScoresheet(
	locals: App.Locals,
	participantId: string,
	judgeId: string
): Promise<{ id: string; status: string; live_sprint_time_seconds: number | null } | null> {
	const { data: existing } = await locals.supabase
		.from('scoresheets')
		.select('id, status, live_sprint_time_seconds')
		.eq('participant_id', participantId)
		.eq('judge_id', judgeId)
		.maybeSingle();
	if (existing) return existing as any;

	const { data: created, error: insErr } = await locals.supabase
		.from('scoresheets')
		.insert({ participant_id: participantId, judge_id: judgeId, status: 'draft' })
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
	}>;
	sprintTimeSeconds: number | null | undefined;
} {
	// The form sends one `criterion_id` per card, plus per-criterion fields
	// keyed by id (`level__<id>`, `points__<id>`, `comment__<id>`). We assemble
	// each (id, level, points, comment) tuple and drop cards that aren't fully
	// scored yet.
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
		scores.push({
			criterionId: id,
			level: lvlRaw as PerfLevel,
			points: Math.round(pts),
			comment: cmRaw.length === 0 ? null : cmRaw
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

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		const sheet = await getOrCreateScoresheet(locals, params.participantId, profile.id);
		if (!sheet) {
			return fail(500, { saveError: 'Could not create or load scoresheet.' });
		}
		if (sheet.status !== 'draft') {
			return fail(409, { saveError: 'Scoresheet is locked (already submitted).' });
		}

		const form = await request.formData();
		const { scores, sprintTimeSeconds } = parsePayload(form);

		// Idempotent per-row upsert on (scoresheet_id, criterion_id).
		if (scores.length > 0) {
			const rows = scores.map((s) => ({
				scoresheet_id: sheet.id,
				criterion_id: s.criterionId,
				level: s.level,
				points: s.points,
				comment: s.comment
			}));
			const { error: upErr } = await locals.supabase
				.from('scores')
				.upsert(rows, { onConflict: 'scoresheet_id,criterion_id' });
			if (upErr) {
				return fail(400, { saveError: upErr.message });
			}
		}

		if (sprintTimeSeconds !== undefined) {
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

		// Always re-save first so a click-to-submit also commits the latest values.
		const form = await request.formData();
		const { scores, sprintTimeSeconds } = parsePayload(form);

		const sheet = await getOrCreateScoresheet(locals, params.participantId, profile.id);
		if (!sheet) {
			return fail(500, { submitError: 'Could not load scoresheet.' });
		}
		if (sheet.status !== 'draft') {
			return fail(409, { submitError: 'Scoresheet already submitted.' });
		}

		if (scores.length > 0) {
			const { error: upErr } = await locals.supabase
				.from('scores')
				.upsert(
					scores.map((s) => ({
						scoresheet_id: sheet.id,
						criterion_id: s.criterionId,
						level: s.level,
						points: s.points,
						comment: s.comment
					})),
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
				submitError: 'Enter sprint time (mm:ss) or raise a DQ flag before submitting.'
			});
		}

		const { error: upStatusErr } = await locals.supabase
			.from('scoresheets')
			.update({ status: 'submitted', submitted_at: new Date().toISOString() })
			.eq('id', sheet.id);
		if (upStatusErr) return fail(400, { submitError: upStatusErr.message });

		throw redirect(303, `/judge/done/${sheet.id}`);
	},

	flagDq: async ({ request, locals, params }) => {
		const profile = await loadActorProfile(locals);

		const sheet = await getOrCreateScoresheet(locals, params.participantId, profile.id);
		if (!sheet) return fail(500, { dqError: 'Could not load scoresheet.' });

		const form = await request.formData();
		const reason = String(form.get('reason') ?? '').trim();
		// SECURITY: cap before trim to bound work on pathological input.
		const notes = String(form.get('notes') ?? '').slice(0, MAX_COMMENT_LENGTH).trim();

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
		// Require a substantive note. A single "." or "n/a" leaves no audit
		// trail for what justified a DQ — every DQ is consequential, the
		// note must read like a sentence.
		if (notes.length < 10) {
			return fail(400, { dqError: 'DQ note must be at least 10 characters explaining what happened.' });
		}

		// Check whether an unresolved DQ already exists — if so, update its notes
		// rather than insert a duplicate.
		const { data: existing } = await locals.supabase
			.from('disqualifications')
			.select('id')
			.eq('scoresheet_id', sheet.id)
			.is('cleared_by', null)
			.maybeSingle();

		if (existing) {
			const { error: upErr } = await locals.supabase
				.from('disqualifications')
				.update({ reason, notes })
				.eq('id', existing.id);
			if (upErr) return fail(400, { dqError: upErr.message });
		} else {
			const { error: insErr } = await locals.supabase
				.from('disqualifications')
				.insert({
					scoresheet_id: sheet.id,
					reason,
					notes,
					raised_by: profile.id
				});
			if (insErr) return fail(400, { dqError: insErr.message });
		}

		return { dqRaised: true };
	}
};
