// /admin/schools — list, create, edit, delete-if-empty, CSV import.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { parseCsv } from '$lib/utils/csv';

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
		.order('name', { ascending: true });

	if (sErr) throw error(500, sErr.message);

	// Pull all participants once and count by school_id.
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
	create: async ({ request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!name) return fail(400, { error: 'Name is required.' });

		const { error: insErr } = await supabaseAdmin
			.from('schools')
			.insert({ name, short_code: shortCode });

		if (insErr) {
			if (insErr.code === '23505') {
				return fail(400, { error: 'A school with this name already exists.' });
			}
			return fail(400, { error: insErr.message });
		}
		return { ok: true, message: `Added "${name}".` };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const shortCode = String(form.get('short_code') ?? '').trim() || null;
		if (!id || !name) return fail(400, { error: 'Missing id or name.' });

		const { error: updErr } = await supabaseAdmin
			.from('schools')
			.update({ name, short_code: shortCode })
			.eq('id', id);

		if (updErr) {
			if (updErr.code === '23505') {
				return fail(400, { error: 'Another school with this name already exists.' });
			}
			return fail(400, { error: updErr.message });
		}
		return { ok: true, message: 'School updated.' };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		// Refuse deletion if any participants reference this school.
		const { count } = await supabaseAdmin
			.from('participants')
			.select('id', { count: 'exact', head: true })
			.eq('school_id', id);

		if ((count ?? 0) > 0) {
			return fail(409, {
				error: `Cannot delete — ${count} participant${count === 1 ? '' : 's'} still reference this school.`
			});
		}

		const { error: delErr } = await supabaseAdmin.from('schools').delete().eq('id', id);
		if (delErr) return fail(400, { error: delErr.message });
		return { ok: true, message: 'School deleted.' };
	},

	import: async ({ request }) => {
		const form = await request.formData();
		const csvText = String(form.get('csv') ?? '');
		if (!csvText) return fail(400, { error: 'No CSV provided.' });

		const parsed = parseCsv(csvText);
		if (parsed.errors.length > 0) {
			return fail(400, {
				error: `CSV has ${parsed.errors.length} malformed row${parsed.errors.length === 1 ? '' : 's'}: ${parsed.errors
					.slice(0, 5)
					.map((e) => `line ${e.line}: ${e.message}`)
					.join('; ')}`
			});
		}

		if (!parsed.headers.includes('name')) {
			return fail(400, { error: 'CSV must include a `name` column.' });
		}

		// Filter empties, normalise.
		const rows = parsed.rows
			.map((r) => ({
				name: (r.name ?? '').trim(),
				short_code: (r.short_code ?? '').trim() || null
			}))
			.filter((r) => r.name.length > 0);

		if (rows.length === 0) return fail(400, { error: 'No rows to import.' });

		// Pull existing names to dedupe (do not partial-commit on conflict).
		const { data: existing } = await supabaseAdmin.from('schools').select('name');
		const existingNames = new Set((existing ?? []).map((s) => (s.name as string).toLowerCase()));

		const newRows = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
		const skipped = rows.length - newRows.length;

		if (newRows.length === 0) {
			return {
				ok: true,
				message: `All ${rows.length} school${rows.length === 1 ? '' : 's'} already exist — nothing imported.`,
				inserted: 0,
				skipped
			};
		}

		const { error: insErr } = await supabaseAdmin.from('schools').insert(newRows);
		if (insErr) return fail(400, { error: insErr.message });

		return {
			ok: true,
			message: `Imported ${newRows.length} new school${newRows.length === 1 ? '' : 's'}${
				skipped > 0 ? ` (${skipped} duplicates skipped)` : ''
			}.`,
			inserted: newRows.length,
			skipped
		};
	}
};
