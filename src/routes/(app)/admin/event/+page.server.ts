// /admin/event — single-card page editing the singleton event_state row.
// Actions:
//   update — change event_name + sprint_minutes (event_date is read-only
//            after the first save per spec; we still allow blank → set once)
//   lock   — toggle the locked flag; sets locked_at + locked_by

import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async () => {
	const { data: row, error: eErr } = await supabaseAdmin
		.from('event_state')
		.select(
			'id, event_name, event_date, sprint_minutes, locked, locked_at, locked_by, updated_at'
		)
		.eq('id', 1)
		.single();
	if (eErr || !row) throw error(500, eErr?.message ?? 'event_state row missing');

	let lockedByName: string | null = null;
	if (row.locked_by) {
		const { data: lb } = await supabaseAdmin
			.from('profiles')
			.select('full_name')
			.eq('id', row.locked_by)
			.single();
		lockedByName = (lb?.full_name as string | undefined) ?? null;
	}

	return {
		event: {
			eventName: row.event_name as string,
			eventDate: (row.event_date as string | null) ?? null,
			sprintMinutes: row.sprint_minutes as number,
			locked: row.locked as boolean,
			lockedAt: (row.locked_at as string | null) ?? null,
			lockedByName,
			updatedAt: row.updated_at as string
		}
	};
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const form = await request.formData();
		const eventName = String(form.get('event_name') ?? '').trim();
		const eventDate = String(form.get('event_date') ?? '').trim() || null;
		const sprintMinutes = Number(form.get('sprint_minutes') ?? 45);
		if (!eventName) return fail(400, { error: 'Event name is required.' });
		if (!Number.isFinite(sprintMinutes) || sprintMinutes < 1 || sprintMinutes > 240) {
			return fail(400, { error: 'Sprint minutes must be between 1 and 240.' });
		}

		const patch: Record<string, unknown> = {
			event_name: eventName,
			sprint_minutes: Math.round(sprintMinutes)
		};
		if (eventDate) patch.event_date = eventDate;

		const { error: updErr } = await locals.supabase
			.from('event_state')
			.update(patch)
			.eq('id', 1);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'Event settings saved.' };
	},

	lock: async ({ request, locals }) => {
		const form = await request.formData();
		const lock = String(form.get('lock') ?? 'true') === 'true';

		const patch: Record<string, unknown> = {
			locked: lock,
			locked_at: lock ? new Date().toISOString() : null,
			locked_by: lock ? locals.user?.id ?? null : null
		};

		const { error: updErr } = await locals.supabase
			.from('event_state')
			.update(patch)
			.eq('id', 1);
		if (updErr) return fail(400, { error: updErr.message });
		return {
			ok: true,
			message: lock ? 'Event locked — scoresheets are now read-only.' : 'Event unlocked.'
		};
	}
};
