// /registration/schools — registration_committee + super_admin school CRUD.
//
// Same shape as /admin/schools but guarded with requireRegistrationOrAdmin
// so the registration committee can manage schools without being given
// super_admin privileges across the rest of the app.
//
// All mutations use supabaseAdmin (service role) so they're never silently
// no-op'd by RLS. The inline guard is the real security boundary because
// layout guards don't run before form actions.

import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireRegistrationOrAdmin } from '$lib/server/guards';
import { appendAudit } from '$lib/server/audit-local';

export type SchoolRow = {
	id: string;
	name: string;
	shortCode: string | null;
	participantCount: number;
	createdAt: string;
};

export const load: PageServerLoad = async () => {
	const { data: schools, error: sErr } = await supabaseAdmin
		.from('schools')
		.select('id, name, short_code, created_at')
		.order('name');
	if (sErr) throw error(500, sErr.message);

	const { data: parts } = await supabaseAdmin.from('participants').select('school_id');
	const counts = new Map<string, number>();
	for (const p of parts ?? []) {
		counts.set(p.school_id as string, (counts.get(p.school_id as string) ?? 0) + 1);
	}

	const rows: SchoolRow[] = (schools ?? []).map((s) => ({
		id: s.id as string,
		name: s.name as string,
		shortCode: (s.short_code as string | null) ?? null,
		participantCount: counts.get(s.id as string) ?? 0,
		createdAt: s.created_at as string
	}));

	return { rows };
};

export const actions: Actions = {
	create: async ({ request, locals, getClientAddress }) => {
		const session = await requireRegistrationOrAdmin(locals.user);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!name) return fail(400, { error: 'School name is required.' });

		const { data: inserted, error: insErr } = await supabaseAdmin
			.from('schools')
			.insert({ name, short_code: shortCode })
			.select('id')
			.single();
		if (insErr) return fail(400, { error: insErr.message });

		await appendAudit({
			actor: {
				id: session.user.id,
				role: session.role,
				fullName: session.fullName,
				email: session.email
			},
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'school_create',
			targetType: 'school',
			targetId: (inserted?.id as string) ?? null,
			before: null,
			after: { name, short_code: shortCode },
			reason: null
		});

		return { ok: true, message: `Added ${name}.` };
	},

	update: async ({ request, locals, getClientAddress }) => {
		const session = await requireRegistrationOrAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!id || !name) return fail(400, { error: 'Missing id or name.' });

		const { data: before } = await supabaseAdmin
			.from('schools')
			.select('name, short_code')
			.eq('id', id)
			.single();

		const { error: updErr } = await supabaseAdmin
			.from('schools')
			.update({ name, short_code: shortCode })
			.eq('id', id);
		if (updErr) return fail(400, { error: updErr.message });

		await appendAudit({
			actor: {
				id: session.user.id,
				role: session.role,
				fullName: session.fullName,
				email: session.email
			},
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'school_update',
			targetType: 'school',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: { name, short_code: shortCode },
			reason: null
		});

		return { ok: true, message: 'School updated.' };
	},

	delete: async ({ request, locals, getClientAddress }) => {
		const session = await requireRegistrationOrAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		const { count } = await supabaseAdmin
			.from('participants')
			.select('id', { count: 'exact', head: true })
			.eq('school_id', id);
		if (count && count > 0) {
			return fail(409, {
				error: `Cannot delete: this school has ${count} participant(s). Move or delete them first.`
			});
		}

		const { data: before } = await supabaseAdmin
			.from('schools')
			.select('name, short_code')
			.eq('id', id)
			.single();

		const { data: deletedRows, error: delErr } = await supabaseAdmin
			.from('schools')
			.delete()
			.eq('id', id)
			.select('id');

		if (delErr) return fail(400, { error: delErr.message });
		if (!deletedRows || deletedRows.length === 0) {
			return fail(404, { error: 'School not found (already deleted?).' });
		}

		await appendAudit({
			actor: {
				id: session.user.id,
				role: session.role,
				fullName: session.fullName,
				email: session.email
			},
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'school_delete',
			targetType: 'school',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: null,
			reason: null
		});

		return { ok: true, message: 'School deleted.' };
	}
};
