// /admin/event — event_state singleton page.
// Edit event name + sprint minutes; date is read-only after first save.
// Lock toggle flips the global `locked` flag (RLS enforces read-only afterwards).

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export type EventStateRow = {
	id: number;
	eventName: string;
	eventDate: string | null;
	sprintMinutes: number;
	locked: boolean;
	lockedAt: string | null;
	lockedBy: string | null;
	lockedByName: string | null;
};

export const load: PageServerLoad = async () => {
	const { data, error: dbErr } = await supabaseAdmin
		.from('event_state')
		.select('id, event_name, event_date, sprint_minutes, locked, locked_at, locked_by')
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
		locked: data.locked as boolean,
		lockedAt: (data.locked_at as string | null) ?? null,
		lockedBy: (data.locked_by as string | null) ?? null,
		lockedByName
	};

	return { event: row };
};

export const actions: Actions = {
	updateMeta: async ({ request }) => {
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

		// Date is read-only after first save — only set if currently null.
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

	lock: async ({ locals }) => {
		if (!locals.user) return fail(401, { error: 'not authenticated' });
		const { error: lockErr } = await supabaseAdmin
			.from('event_state')
			.update({
				locked: true,
				locked_at: new Date().toISOString(),
				locked_by: locals.user.id
			})
			.eq('id', 1);
		if (lockErr) return fail(400, { error: lockErr.message });
		return { ok: true, message: 'Event locked. All scoresheets are now read-only.' };
	},

	unlock: async () => {
		const { error: unlockErr } = await supabaseAdmin
			.from('event_state')
			.update({
				locked: false,
				locked_at: null,
				locked_by: null
			})
			.eq('id', 1);
		if (unlockErr) return fail(400, { error: unlockErr.message });
		return { ok: true, message: 'Event unlocked. Scoresheets are editable again.' };
	}
};
