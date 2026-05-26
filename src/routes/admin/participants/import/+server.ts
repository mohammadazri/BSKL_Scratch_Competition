// POST /admin/participants/import — bulk-insert participants from a parsed CSV.
//
// Body: { rows: [{ full_name, school_name, category, theme }], commit?: boolean }
// `theme` is required as of migration 016.
// On commit=false (default): returns a preview summary { newSchools, participants,
//   errors } without writing anything.
// On commit=true: creates missing schools first, then inserts participants.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import type { Category, Theme } from '$lib/types';

/** Hard cap on inbound import payload — protects against memory-exhaustion DoS. */
const MAX_IMPORT_ROWS = 2000;

interface RowIn {
	full_name?: unknown;
	school_name?: unknown;
	category?: unknown;
	theme?: unknown;
}

const isCategory = (v: unknown): v is Category => v === 'A' || v === 'B' || v === 'C';
const isTheme = (v: unknown): v is Theme =>
	v === 'Eco-Warriors' || v === 'Smart Cities' || v === 'Space Pioneers';

export const POST: RequestHandler = async ({ request, locals }) => {
	// SECURITY: +server.ts handlers don't run layout guards. Block non-admin
	// callers before parsing the (potentially huge) body.
	await requireSuperAdmin(locals.user);

	const body = (await request.json().catch(() => null)) as
		| { rows?: RowIn[]; commit?: boolean }
		| null;
	if (!body || !Array.isArray(body.rows)) {
		return json({ ok: false, error: 'Missing or malformed rows[].' }, { status: 400 });
	}
	if (body.rows.length > MAX_IMPORT_ROWS) {
		return json(
			{ ok: false, error: `Too many rows (${body.rows.length}). Limit is ${MAX_IMPORT_ROWS}.` },
			{ status: 413 }
		);
	}

	// Parse + validate each row.
	const errors: { line: number; message: string }[] = [];
	type CleanRow = { full_name: string; school_name: string; category: Category; theme: Theme };
	const clean: CleanRow[] = [];
	let i = 0;
	for (const r of body.rows) {
		i++;
		const full_name = typeof r.full_name === 'string' ? r.full_name.trim() : '';
		const school_name = typeof r.school_name === 'string' ? r.school_name.trim() : '';
		const cat = r.category;
		const theme = typeof r.theme === 'string' ? r.theme.trim() : '';
		if (!full_name) {
			errors.push({ line: i, message: 'missing full_name' });
			continue;
		}
		if (!school_name) {
			errors.push({ line: i, message: 'missing school_name' });
			continue;
		}
		if (!isCategory(cat)) {
			errors.push({ line: i, message: `invalid category "${String(cat)}"` });
			continue;
		}
		if (!theme) {
			errors.push({ line: i, message: 'missing theme (Eco-Warriors / Smart Cities / Space Pioneers)' });
			continue;
		}
		if (!isTheme(theme)) {
			errors.push({ line: i, message: `invalid theme "${theme}"` });
			continue;
		}
		clean.push({
			full_name,
			school_name,
			category: cat,
			theme
		});
	}

	if (errors.length > 0) {
		return json({ ok: false, errors, parsed: clean.length }, { status: 400 });
	}

	// Bucket new vs existing schools.
	const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
	const schoolByName = new Map<string, string>();
	for (const s of schools ?? []) {
		schoolByName.set((s.name as string).toLowerCase(), s.id as string);
	}
	const newSchoolNames = new Set<string>();
	for (const c of clean) {
		if (!schoolByName.has(c.school_name.toLowerCase())) newSchoolNames.add(c.school_name);
	}

	if (!body.commit) {
		return json({
			ok: true,
			preview: true,
			newSchools: [...newSchoolNames],
			participants: clean.length,
			byCategory: {
				A: clean.filter((c) => c.category === 'A').length,
				B: clean.filter((c) => c.category === 'B').length,
				C: clean.filter((c) => c.category === 'C').length
			}
		});
	}

	// commit=true → create missing schools, then bulk-insert participants.
	if (newSchoolNames.size > 0) {
		const toInsert = [...newSchoolNames].map((name) => ({ name, short_code: null }));
		const { data: created, error: schErr } = await locals.supabase
			.from('schools')
			.insert(toInsert)
			.select('id, name');
		if (schErr) return json({ ok: false, error: schErr.message }, { status: 400 });
		for (const s of created ?? []) {
			schoolByName.set((s.name as string).toLowerCase(), s.id as string);
		}
	}

	const participantsRows = clean.map((c) => ({
		full_name: c.full_name,
		school_id: schoolByName.get(c.school_name.toLowerCase())!,
		category: c.category,
		theme: c.theme
	}));

	const { error: pErr } = await locals.supabase
		.from('participants')
		.insert(participantsRows);
	if (pErr) return json({ ok: false, error: pErr.message }, { status: 400 });

	return json({ ok: true, created: participantsRows.length, newSchools: newSchoolNames.size });
};
