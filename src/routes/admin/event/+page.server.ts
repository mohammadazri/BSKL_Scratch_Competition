// /admin/event — event_state singleton page.
//
// Two concepts here:
//   • Event metadata: name, sprint minutes, date.
//   • Event phase: setup → section_a → section_b → finalised. Drives what
//     judges can score on the marking page.
//   • Legacy `locked` flag: emergency hard-stop. `finalised` phase is the
//     normal end state; `locked` is a separate kill-switch we keep for
//     backwards compatibility.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import { appendAudit, type AuditActor } from '$lib/server/audit-local';
import { reshuffleSectionBForCategory } from '$lib/server/reshuffle';
import type { EventPhase } from '$lib/types';

export type EventStateRow = {
	id: number;
	eventName: string;
	eventDate: string | null;
	sprintMinutes: number;
	phase: EventPhase;
	locked: boolean;
	lockedAt: string | null;
	lockedBy: string | null;
	lockedByName: string | null;
};

const VALID_PHASES = new Set<EventPhase>(['setup', 'section_a', 'section_b', 'finalised']);

function actor(session: {
	user: { id: string };
	role: 'super_admin' | 'judge' | 'viewer' | 'registration_committee';
	fullName: string;
	email: string;
}): AuditActor {
	return { id: session.user.id, role: session.role, fullName: session.fullName, email: session.email };
}

export const load: PageServerLoad = async () => {
	const { data, error: dbErr } = await supabaseAdmin
		.from('event_state')
		.select('id, event_name, event_date, sprint_minutes, phase, locked, locked_at, locked_by')
		.eq('id', 1)
		.single();

	if (dbErr || !data) throw error(500, dbErr?.message ?? 'event_state missing');

	let lockedByName: string | null = null;
	if (data.locked_by) {
		const { data: profile } = await supabaseAdmin
			.from('profiles')
			.select('full_name')
			.eq('id', data.locked_by)
			.single();
		lockedByName = (profile?.full_name as string | null) ?? null;
	}

	const row: EventStateRow = {
		id: data.id as number,
		eventName: data.event_name as string,
		eventDate: (data.event_date as string | null) ?? null,
		sprintMinutes: data.sprint_minutes as number,
		phase: (data.phase as EventPhase) ?? 'setup',
		locked: data.locked as boolean,
		lockedAt: (data.locked_at as string | null) ?? null,
		lockedBy: (data.locked_by as string | null) ?? null,
		lockedByName
	};

	return { event: row };
};

export const actions: Actions = {
	updateMeta: async ({ request, locals }) => {
		await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const eventName = String(form.get('event_name') ?? '').trim();
		const sprintMinutes = Number(form.get('sprint_minutes') ?? 45);
		const eventDate = String(form.get('event_date') ?? '').trim() || null;
		if (!eventName) return fail(400, { error: 'Event name is required.' });
		if (!Number.isFinite(sprintMinutes) || sprintMinutes < 1 || sprintMinutes > 240) {
			return fail(400, { error: 'Sprint minutes must be between 1 and 240.' });
		}

		const update: Record<string, unknown> = {
			event_name: eventName,
			sprint_minutes: sprintMinutes
		};

		const { data: current } = await supabaseAdmin
			.from('event_state')
			.select('event_date')
			.eq('id', 1)
			.single();
		if (!current?.event_date && eventDate) {
			update.event_date = eventDate;
		}

		const { error: updErr } = await supabaseAdmin
			.from('event_state')
			.update(update)
			.eq('id', 1);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'Event details saved.' };
	},

	setPhase: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const phase = String(form.get('phase') ?? '') as EventPhase;
		if (!VALID_PHASES.has(phase)) {
			return fail(400, { error: 'Invalid phase.' });
		}

		const { data: before } = await supabaseAdmin
			.from('event_state')
			.select('phase')
			.eq('id', 1)
			.single();

		const beforePhase = (before?.phase as EventPhase | null) ?? null;
		const advancingToSectionB = phase === 'section_b' && beforePhase !== 'section_b';

		const { error: updErr } = await supabaseAdmin
			.from('event_state')
			.update({ phase })
			.eq('id', 1);
		if (updErr) return fail(400, { error: updErr.message });

		// AUTO RE-SHUFFLE: when transitioning into section_b, automatically
		// re-assign each category's participants to a DIFFERENT judge for
		// fairness (the same judge can't grade both sections of one student
		// — that's how single-grader bias creeps in). We do this server-side
		// at the moment of transition so the admin doesn't have to remember
		// to click a separate "shuffle" button per category.
		const reshuffleResults: Array<{
			category: 'A' | 'B' | 'C';
			ok: boolean;
			message: string;
			conflicts: number;
		}> = [];

		if (advancingToSectionB) {
			for (const category of ['A', 'B', 'C'] as const) {
				try {
					const result = await reshuffleSectionBForCategory(category);
					reshuffleResults.push({
						category,
						ok: result.ok,
						message: result.message ?? '',
						conflicts: result.conflicts ?? 0
					});
				} catch (e) {
					reshuffleResults.push({
						category,
						ok: false,
						message: e instanceof Error ? e.message : String(e),
						conflicts: 0
					});
				}
			}
		}

		await appendAudit({
			actor: actor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'event_phase_change',
			targetType: 'event_state',
			targetId: '1',
			before: { phase: beforePhase },
			after: { phase, reshuffle: advancingToSectionB ? reshuffleResults : null },
			reason: null
		});

		const labels: Record<EventPhase, string> = {
			setup: 'Setup',
			section_a: 'Section A scoring (pre-event)',
			section_b: 'Section B scoring (event day)',
			finalised: 'Finalised'
		};
		const reshuffleSummary = advancingToSectionB
			? ' · Re-shuffled Section B assignments: ' +
				reshuffleResults
					.map((r) => `Cat ${r.category} ${r.ok ? '✓' : '✕'}`)
					.join(', ')
			: '';
		return {
			ok: true,
			message: `Event phase set to ${labels[phase]}.${reshuffleSummary}`
		};
	},

	lock: async ({ locals, request, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const { error: lockErr } = await supabaseAdmin
			.from('event_state')
			.update({
				locked: true,
				locked_at: new Date().toISOString(),
				locked_by: session.user.id
			})
			.eq('id', 1);
		if (lockErr) return fail(400, { error: lockErr.message });
		await appendAudit({
			actor: actor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'event_lock',
			targetType: 'event_state',
			targetId: '1',
			before: null,
			after: { locked: true },
			reason: null
		});
		return { ok: true, message: 'Event locked. All scoresheets are now read-only.' };
	},

	unlock: async ({ locals, request, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const { error: unlockErr } = await supabaseAdmin
			.from('event_state')
			.update({
				locked: false,
				locked_at: null,
				locked_by: null
			})
			.eq('id', 1);
		if (unlockErr) return fail(400, { error: unlockErr.message });
		await appendAudit({
			actor: actor(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'event_unlock',
			targetType: 'event_state',
			targetId: '1',
			before: { locked: true },
			after: { locked: false },
			reason: null
		});
		return { ok: true, message: 'Event unlocked. Scoresheets are editable again.' };
	}
};
