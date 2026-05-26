// /admin/participants — list, create, edit, delete, DQ toggle.
//
// DQ model decision (per TRACK_2_ADMIN.md): keep `disqualifications.scoresheet_id`
// NOT NULL and use `participants.qualified = false` for participant-level DQ
// here. The reason + notes are captured in `participants.notes` (prefixed
// with "[DQ: <reason>] ..."). The `disqualifications` table is exclusively
// populated by judges from the scoring form (Track 3). This keeps the schema
// untouched and matches the spec's recommended path.

import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import { appendAudit } from '$lib/server/audit-local';
import type { Category, DqReason, Theme } from '$lib/types';

export type ParticipantRow = {
	id: string;
	fullName: string;
	schoolId: string;
	schoolName: string;
	category: Category;
	theme: Theme | null;
	qualified: boolean;
	notes: string | null;
	judgeName: string | null;
	createdAt: string;
};

export type SchoolLite = { id: string; name: string };

export const load: PageServerLoad = async () => {
	const { data: parts, error: pErr } = await supabaseAdmin
		.from('participants')
		.select(
			'id, full_name, school_id, category, theme, qualified, notes, created_at, schools!inner(name)'
		)
		.order('full_name');
	if (pErr) throw error(500, pErr.message);

	const { data: schools } = await supabaseAdmin
		.from('schools')
		.select('id, name')
		.order('name');

	const { data: assignments } = await supabaseAdmin
		.from('assignments')
		.select('participant_id, judge_id, profiles!inner(full_name)');

	const judgeByParticipant = new Map<string, string>();
	for (const a of assignments ?? []) {
		const prof = (a as { profiles?: { full_name?: string } | { full_name?: string }[] }).profiles;
		const fullName = Array.isArray(prof)
			? (prof[0]?.full_name ?? null)
			: (prof?.full_name ?? null);
		if (fullName) judgeByParticipant.set(a.participant_id as string, fullName);
	}

	const rows: ParticipantRow[] = (parts ?? []).map((p) => {
		const sch = (p as { schools?: { name?: string } | { name?: string }[] }).schools;
		const schoolName = Array.isArray(sch) ? (sch[0]?.name ?? '') : (sch?.name ?? '');
		return {
			id: p.id as string,
			fullName: p.full_name as string,
			schoolId: p.school_id as string,
			schoolName,
			category: p.category as Category,
			theme: (p.theme as Theme | null) ?? null,
			qualified: p.qualified as boolean,
			notes: (p.notes as string | null) ?? null,
			judgeName: judgeByParticipant.get(p.id as string) ?? null,
			createdAt: p.created_at as string
		};
	});

	return {
		rows,
		schools: (schools ?? []) as SchoolLite[]
	};
};

function parseCategory(v: FormDataEntryValue | null): Category | null {
	if (v === 'A' || v === 'B' || v === 'C') return v;
	return null;
}

function parseTheme(v: FormDataEntryValue | null): Theme | null {
	if (v === 'Eco-Warriors' || v === 'Smart Cities' || v === 'Space Pioneers') return v;
	return null;
}

function parseDqReason(v: FormDataEntryValue | null): DqReason | null {
	const set: DqReason[] = [
		'complete_on_arrival',
		'tutorial_or_ai_use',
		'parental_assistance',
		'unsportsmanlike_conduct',
		'other'
	];
	const s = String(v ?? '');
	return (set as string[]).includes(s) ? (s as DqReason) : null;
}

// Every action below uses `supabaseAdmin` (service role, bypasses RLS) AND
// inline-guards with `requireSuperAdmin`. Layout guards don't run before form
// actions, so the inline check is the real security boundary. Without it,
// any authenticated user could POST here and edit participants.
//
// Why supabaseAdmin and not locals.supabase: when a row doesn't match the
// caller's RLS policy, supabase-js returns `{ error: null, data: [] }` — no
// rows affected, no error. That's how the "delete shows success but row
// stays" bug happened. Using the service role removes that footgun.
export const actions: Actions = {
	create: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const fullName = String(form.get('full_name') ?? '').trim();
		const schoolId = String(form.get('school_id') ?? '');
		const category = parseCategory(form.get('category'));
		const theme = parseTheme(form.get('theme'));
		if (!fullName || !schoolId || !category || !theme) {
			return fail(400, { error: 'Name, school, category and theme are all required.' });
		}

		const { data: inserted, error: insErr } = await supabaseAdmin
			.from('participants')
			.insert({ full_name: fullName, school_id: schoolId, category, theme })
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
			action: 'participant_create',
			targetType: 'participant',
			targetId: (inserted?.id as string) ?? null,
			before: null,
			after: { full_name: fullName, school_id: schoolId, category, theme },
			reason: null
		});

		return { ok: true, message: `Added ${fullName}.` };
	},

	update: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const fullName = String(form.get('full_name') ?? '').trim();
		const schoolId = String(form.get('school_id') ?? '');
		const category = parseCategory(form.get('category'));
		const theme = parseTheme(form.get('theme'));
		if (!id || !fullName || !schoolId || !category || !theme) {
			return fail(400, { error: 'Name, school, category and theme are all required.' });
		}

		const { data: before } = await supabaseAdmin
			.from('participants')
			.select('full_name, school_id, category, theme')
			.eq('id', id)
			.single();

		const { error: updErr } = await supabaseAdmin
			.from('participants')
			.update({ full_name: fullName, school_id: schoolId, category, theme })
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
			action: 'participant_update',
			targetType: 'participant',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: { full_name: fullName, school_id: schoolId, category, theme },
			reason: null
		});

		return { ok: true, message: 'Participant updated.' };
	},

	delete: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Missing id.' });

		// Capture snapshot for audit before the row vanishes.
		const { data: before } = await supabaseAdmin
			.from('participants')
			.select('full_name, school_id, category, theme, qualified, notes')
			.eq('id', id)
			.single();

		// .select() forces Supabase to return the deleted rows so we can verify
		// the delete actually happened (vs silently affecting 0 rows).
		const { data: deletedRows, error: delErr } = await supabaseAdmin
			.from('participants')
			.delete()
			.eq('id', id)
			.select('id');

		if (delErr) return fail(400, { error: delErr.message });
		if (!deletedRows || deletedRows.length === 0) {
			return fail(404, { error: 'Participant not found (already deleted?).' });
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
			action: 'participant_delete',
			targetType: 'participant',
			targetId: id,
			before: (before as Record<string, unknown>) ?? null,
			after: null,
			reason: null
		});

		return { ok: true, message: 'Participant deleted.' };
	},

	setDq: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const dq = String(form.get('dq') ?? 'true') === 'true';
		const reason = parseDqReason(form.get('reason'));
		const notes = String(form.get('notes') ?? '').slice(0, 2000).trim();

		if (!id) return fail(400, { error: 'Missing id.' });
		if (dq && (!reason || notes.length < 10)) {
			return fail(400, {
				error: 'DQ requires a reason and a note of at least 10 characters explaining what happened.'
			});
		}

		const { data: existing } = await supabaseAdmin
			.from('participants')
			.select('notes, qualified')
			.eq('id', id)
			.single();

		const baseNotes = ((existing?.notes as string | null) ?? '')
			.replace(/\[DQ:[^\]]*]\s*[^\n]*\n?/g, '')
			.trim();
		const newNotes = dq
			? `[DQ: ${reason}] ${notes}${baseNotes ? `\n${baseNotes}` : ''}`
			: baseNotes || null;

		const { error: updErr } = await supabaseAdmin
			.from('participants')
			.update({ qualified: !dq, notes: newNotes })
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
			action: dq ? 'dq_flag_raise' : 'dq_flag_clear',
			targetType: 'participant',
			targetId: id,
			before: { qualified: existing?.qualified, notes: existing?.notes },
			after: { qualified: !dq, notes: newNotes },
			reason: dq ? `${reason}: ${notes}` : null
		});

		return {
			ok: true,
			message: dq ? 'Participant disqualified.' : 'Participant re-qualified.'
		};
	}
};
