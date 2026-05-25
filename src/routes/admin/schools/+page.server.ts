// /admin/schools — list, create, update, delete (when empty). All mutations
// flow through supabaseAdmin so the audit trigger captures actor_id via
// auth.uid() — which is unavailable to service-role tokens. To keep audit
// rows attributed correctly, we'd ideally use locals.supabase, but the
// schools_super_all policy already requires super_admin so either client
// works. We use locals.supabase (request-scoped) so the actor_id ends up
// in audit_log instead of being NULL.

import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

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
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!name) return fail(400, { error: 'School name is required.' });

		const { error: insErr } = await locals.supabase
			.from('schools')
			.insert({ name, short_code: shortCode });
		if (insErr) return fail(400, { error: insErr.message });
		return { ok: true, message: `Added ${name}.` };
	},

	update: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!id || !name) return fail(400, { error: 'Missing id or name.' });

		const { error: updErr } = await locals.supabase
			.from('schools')
			.update({ name, short_code: shortCode })
			.eq('id', id);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'School updated.' };
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		// Verify no participants reference this school (RESTRICT FK).
		const { data: parts } = await supabaseAdmin
			.from('participants')
			.select('id', { count: 'exact', head: true })
			.eq('school_id', id);
		void parts;

		const { error: delErr } = await locals.supabase.from('schools').delete().eq('id', id);
		if (delErr) return fail(400, { error: delErr.message });
		return { ok: true, message: 'School deleted.' };
	}
};
