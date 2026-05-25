// /admin/participants — list, create, edit, delete, CSV import, DQ toggle.
//
// DQ handling decision (per TRACK_2_ADMIN.md gotcha):
//   `disqualifications` table is scoresheet-linked (NOT NULL) and is the
//   judge-raised evidence trail. For *participant-level* DQ (admin denies a
//   participant from the whole event), we flip `participants.qualified=false`
//   and store the reason / notes in `participants.notes`. This keeps the
//   schema clean — no NULL scoresheet_id rows — and the leaderboard view
//   already filters by `qualified = true`.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { parseCsv } from '$lib/utils/csv';
import type { Category, DqReason, Theme } from '$lib/types';

const allowedCategories: Category[] = ['A', 'B', 'C'];
const allowedThemes: Theme[] = ['Eco-Warriors', 'Smart Cities', 'Space Pioneers'];
const allowedDqReasons: DqReason[] = [
	'complete_on_arrival',
	'tutorial_or_ai_use',
	'parental_assistance',
	'unsportsmanlike_conduct',
	'other'
];

export type ParticipantRow = {
	id: string;
	fullName: string;
	schoolId: string;
	schoolName: string;
	category: Category;
	theme: Theme | null;
	qualified: boolean;
	notes: string | null;
	judgeId: string | null;
	judgeName: string | null;
};

export type SchoolOption = { id: string; name: string };

export const load: PageServerLoad = async () => {
	const { data: parts, error: pErr } = await supabaseAdmin
		.from('participants')
		.select('id, full_name, school_id, category, theme, qualified, notes')
		.order('full_name', { ascending: true });

	if (pErr) throw error(500, pErr.message);

	const { data: schools } = await supabaseAdmin
		.from('schools')
		.select('id, name')
		.order('name', { ascending: true });
	const schoolNameById = new Map<string, string>();
	for (const s of schools ?? []) schoolNameById.set(s.id as string, s.name as string);

	const { data: assignments } = await supabaseAdmin
		.from('assignments')
		.select('participant_id, judge_id');
	const judgeIdByParticipant = new Map<string, string>();
	for (const a of assignments ?? []) {
		judgeIdByParticipant.set(a.participant_id as string, a.judge_id as string);
	}

	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name')
		.eq('is_active', true);
	const judgeNameById = new Map<string, string>();
	for (const j of judges ?? []) judgeNameById.set(j.id as string, j.full_name as string);

	const rows: ParticipantRow[] = (parts ?? []).map((p) => {
		const judgeId = judgeIdByParticipant.get(p.id as string) ?? null;
		return {
			id: p.id as string,
			fullName: p.full_name as string,
			schoolId: p.school_id as string,
			schoolName: schoolNameById.get(p.school_id as string) ?? '—',
			category: p.category as Category,
			theme: (p.theme as Theme | null) ?? null,
			qualified: p.qualified as boolean,
			notes: (p.notes as string | null) ?? null,
			judgeId,
			judgeName: judgeId ? (judgeNameById.get(judgeId) ?? null) : null
		};
	});

	const schoolOptions: SchoolOption[] = (schools ?? []).map((s) => ({
		id: s.id as string,
		name: s.name as string
	}));

	return { rows, schools: schoolOptions };
};

function parseCategory(v: string): Category | null {
	return allowedCategories.find((c) => c === v) ?? null;
}
function parseTheme(v: string): Theme | null {
	if (!v) return null;
	return allowedThemes.find((t) => t === v) ?? null;
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const fullName = String(form.get('full_name') ?? '').trim();
		const schoolId = String(form.get('school_id') ?? '');
		const category = parseCategory(String(form.get('category') ?? ''));
		const theme = parseTheme(String(form.get('theme') ?? ''));

		if (!fullName || !schoolId || !category) {
			return fail(400, { error: 'Name, school, and category are required.' });
		}

		const { error: insErr } = await supabaseAdmin.from('participants').insert({
			full_name: fullName,
			school_id: schoolId,
			category,
			theme
		});

		if (insErr) return fail(400, { error: insErr.message });
		return { ok: true, message: `Added ${fullName}.` };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const fullName = String(form.get('full_name') ?? '').trim();
		const schoolId = String(form.get('school_id') ?? '');
		const category = parseCategory(String(form.get('category') ?? ''));
		const theme = parseTheme(String(form.get('theme') ?? ''));
		if (!id || !fullName || !schoolId || !category) {
			return fail(400, { error: 'Missing required fields.' });
		}
		const { error: updErr } = await supabaseAdmin
			.from('participants')
			.update({ full_name: fullName, school_id: schoolId, category, theme })
			.eq('id', id);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'Participant updated.' };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });
		const { error: delErr } = await supabaseAdmin.from('participants').delete().eq('id', id);
		if (delErr) return fail(400, { error: delErr.message });
		return { ok: true, message: 'Participant deleted.' };
	},

	dq: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const reasonRaw = String(form.get('reason') ?? '');
		const reason = allowedDqReasons.find((r) => r === reasonRaw);
		const notes = String(form.get('notes') ?? '').trim();
		if (!id || !reason || notes.length < 3) {
			return fail(400, { error: 'Reason and notes (3+ chars) required.' });
		}

		const stampedNote = `[DQ ${reason}] ${notes}`;
		const { error: updErr } = await supabaseAdmin
			.from('participants')
			.update({ qualified: false, notes: stampedNote })
			.eq('id', id);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'Participant disqualified.' };
	},

	requalify: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });
		const { error: updErr } = await supabaseAdmin
			.from('participants')
			.update({ qualified: true, notes: null })
			.eq('id', id);
		if (updErr) return fail(400, { error: updErr.message });
		return { ok: true, message: 'Participant requalified.' };
	},

	importPreview: async ({ request }) => {
		const form = await request.formData();
		const csvText = String(form.get('csv') ?? '');
		const parsed = parseCsv(csvText);
		const requiredHeaders = ['full_name', 'school_name', 'category'];
		const missing = requiredHeaders.filter((h) => !parsed.headers.includes(h));
		if (missing.length > 0) {
			return fail(400, { error: `CSV missing required headers: ${missing.join(', ')}.` });
		}
		// Reject if any malformed rows — no partial commits.
		if (parsed.errors.length > 0) {
			return fail(400, {
				error: `CSV has ${parsed.errors.length} malformed row${parsed.errors.length === 1 ? '' : 's'}: ${parsed.errors
					.slice(0, 5)
					.map((e) => `line ${e.line}: ${e.message}`)
					.join('; ')}`
			});
		}

		const cleanRows: {
			full_name: string;
			school_name: string;
			category: Category;
			theme: Theme | null;
			lineNum: number;
		}[] = [];
		const rowErrors: { line: number; message: string }[] = [];
		for (let i = 0; i < parsed.rows.length; i++) {
			const r = parsed.rows[i];
			const ln = i + 2; // header is line 1
			const fullName = (r.full_name ?? '').trim();
			const schoolName = (r.school_name ?? '').trim();
			const cat = parseCategory((r.category ?? '').trim());
			const themeStr = (r.theme ?? '').trim();
			const theme = themeStr ? parseTheme(themeStr) : null;
			if (themeStr && !theme) {
				rowErrors.push({ line: ln, message: `unknown theme "${themeStr}"` });
				continue;
			}
			if (!fullName) {
				rowErrors.push({ line: ln, message: 'full_name is empty' });
				continue;
			}
			if (!schoolName) {
				rowErrors.push({ line: ln, message: 'school_name is empty' });
				continue;
			}
			if (!cat) {
				rowErrors.push({ line: ln, message: `category must be A, B, or C` });
				continue;
			}
			cleanRows.push({ full_name: fullName, school_name: schoolName, category: cat, theme, lineNum: ln });
		}

		if (rowErrors.length > 0) {
			return fail(400, {
				error: `Row errors: ${rowErrors.slice(0, 5).map((e) => `line ${e.line}: ${e.message}`).join('; ')}`
			});
		}

		const { data: existingSchools } = await supabaseAdmin.from('schools').select('id, name');
		const knownSchools = new Map<string, string>();
		for (const s of existingSchools ?? []) {
			knownSchools.set((s.name as string).toLowerCase(), s.id as string);
		}

		const newSchoolNames = new Set<string>();
		for (const r of cleanRows) {
			if (!knownSchools.has(r.school_name.toLowerCase())) {
				newSchoolNames.add(r.school_name);
			}
		}

		return {
			ok: true,
			preview: true,
			rowCount: cleanRows.length,
			newSchoolCount: newSchoolNames.size,
			newSchoolNames: [...newSchoolNames].sort(),
			// Send back the cleaned-up CSV for the commit step.
			csv: csvText
		};
	},

	importCommit: async ({ request }) => {
		const form = await request.formData();
		const csvText = String(form.get('csv') ?? '');
		const parsed = parseCsv(csvText);

		const requiredHeaders = ['full_name', 'school_name', 'category'];
		const missing = requiredHeaders.filter((h) => !parsed.headers.includes(h));
		if (missing.length > 0) {
			return fail(400, { error: `CSV missing headers: ${missing.join(', ')}.` });
		}

		const cleanRows: {
			full_name: string;
			school_name: string;
			category: Category;
			theme: Theme | null;
		}[] = [];
		for (let i = 0; i < parsed.rows.length; i++) {
			const r = parsed.rows[i];
			const fullName = (r.full_name ?? '').trim();
			const schoolName = (r.school_name ?? '').trim();
			const cat = parseCategory((r.category ?? '').trim());
			const themeStr = (r.theme ?? '').trim();
			const theme = themeStr ? parseTheme(themeStr) : null;
			if (!fullName || !schoolName || !cat) continue;
			cleanRows.push({ full_name: fullName, school_name: schoolName, category: cat, theme });
		}

		// Find-or-create schools.
		const { data: existingSchools } = await supabaseAdmin.from('schools').select('id, name');
		const schoolIdByName = new Map<string, string>();
		for (const s of existingSchools ?? []) {
			schoolIdByName.set((s.name as string).toLowerCase(), s.id as string);
		}

		const uniqueNewSchools = new Set<string>();
		for (const r of cleanRows) {
			if (!schoolIdByName.has(r.school_name.toLowerCase())) {
				uniqueNewSchools.add(r.school_name);
			}
		}

		if (uniqueNewSchools.size > 0) {
			const inserts = [...uniqueNewSchools].map((name) => ({ name }));
			const { data: newSchools, error: schoolErr } = await supabaseAdmin
				.from('schools')
				.insert(inserts)
				.select('id, name');
			if (schoolErr) return fail(400, { error: `Failed to create schools: ${schoolErr.message}` });
			for (const s of newSchools ?? []) {
				schoolIdByName.set((s.name as string).toLowerCase(), s.id as string);
			}
		}

		const participantsToInsert = cleanRows.map((r) => ({
			full_name: r.full_name,
			school_id: schoolIdByName.get(r.school_name.toLowerCase())!,
			category: r.category,
			theme: r.theme
		}));

		const { error: partErr } = await supabaseAdmin
			.from('participants')
			.insert(participantsToInsert);

		if (partErr) return fail(400, { error: partErr.message });

		return {
			ok: true,
			message: `Imported ${participantsToInsert.length} participant${
				participantsToInsert.length === 1 ? '' : 's'
			}${uniqueNewSchools.size > 0 ? ` and created ${uniqueNewSchools.size} new school${uniqueNewSchools.size === 1 ? '' : 's'}` : ''}.`
		};
	}
};
