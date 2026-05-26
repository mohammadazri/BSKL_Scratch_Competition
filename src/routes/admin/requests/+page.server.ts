// /admin/requests — super_admin review queue for judge edit-access requests.
//
// Approve flow:
//   • If the locked aspect was section_a_submitted_at, clear it.
//   • If the locked aspect was status='submitted', flip status back to draft
//     and clear submitted_at so the judge can edit AND eventually re-submit.
//   • Either way: stamp the edit_request row with status='approved',
//     resolved_at, resolved_by, optional resolved_note. Audit-log the action.
//
// Deny: only stamps the request row + audits. The scoresheet stays locked.

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireSuperAdmin } from '$lib/server/guards';
import { appendAudit, type AuditActor } from '$lib/server/audit-local';
import type { Role } from '$lib/types';

export type EditRequestRow = {
	id: string;
	scoresheetId: string;
	participantName: string;
	participantCategory: 'A' | 'B' | 'C';
	judgeName: string;
	judgeEmail: string;
	reason: string;
	status: 'pending' | 'approved' | 'denied';
	createdAt: string;
	resolvedAt: string | null;
	resolvedNote: string | null;
	currentLock: 'section_a' | 'submitted' | 'none';
};

export type DqRequestRow = {
	id: string;
	scoresheetId: string;
	participantId: string;
	participantName: string;
	participantCategory: 'A' | 'B' | 'C';
	judgeName: string;
	reason: string;
	notes: string;
	status: 'pending' | 'approved' | 'denied' | 'cleared';
	createdAt: string;
	approvedAt: string | null;
	deniedAt: string | null;
	resolutionNote: string | null;
};

function actorFromSession(session: {
	user: { id: string };
	role: Role;
	fullName: string;
	email: string;
}): AuditActor {
	return { id: session.user.id, role: session.role, fullName: session.fullName, email: session.email };
}

export const load: PageServerLoad = async () => {
	// Pending first, then resolved most-recent-first.
	const { data: rows, error: rErr } = await supabaseAdmin
		.from('edit_requests')
		.select(
			`
			id, scoresheet_id, reason, status, created_at, resolved_at, resolved_note,
			scoresheets!inner (
				id, status, section_a_submitted_at,
				participants!inner (full_name, category)
			),
			profiles!edit_requests_requested_by_fkey (full_name, email)
		`
		)
		.order('status', { ascending: true })
		.order('created_at', { ascending: false })
		.limit(200);
	if (rErr) throw error(500, rErr.message);

	const result: EditRequestRow[] = (rows ?? []).map((r) => {
		const sheet = (r.scoresheets as unknown) as {
			status: string;
			section_a_submitted_at: string | null;
			participants: { full_name: string; category: 'A' | 'B' | 'C' };
		};
		const judge = (r.profiles as unknown) as { full_name: string; email: string };
		let lock: 'section_a' | 'submitted' | 'none' = 'none';
		if (sheet.status === 'submitted' || sheet.status === 'finalised') lock = 'submitted';
		else if (sheet.section_a_submitted_at) lock = 'section_a';
		return {
			id: r.id as string,
			scoresheetId: r.scoresheet_id as string,
			participantName: sheet.participants.full_name,
			participantCategory: sheet.participants.category,
			judgeName: judge.full_name,
			judgeEmail: judge.email,
			reason: r.reason as string,
			status: r.status as 'pending' | 'approved' | 'denied',
			createdAt: r.created_at as string,
			resolvedAt: (r.resolved_at as string | null) ?? null,
			resolvedNote: (r.resolved_note as string | null) ?? null,
			currentLock: lock
		};
	});

	// ── Pending disqualification requests ─────────────────────────────────
	const { data: dqRows, error: dErr } = await supabaseAdmin
		.from('disqualifications')
		.select(
			`
			id, scoresheet_id, reason, notes, status, created_at, approved_at, denied_at, resolution_note,
			scoresheets!inner (
				participant_id,
				participants!inner (full_name, category)
			),
			profiles!disqualifications_raised_by_fkey (full_name)
		`
		)
		.in('status', ['pending', 'approved', 'denied'])
		.order('status', { ascending: true })
		.order('created_at', { ascending: false })
		.limit(200);
	if (dErr) throw error(500, dErr.message);

	const dqResult: DqRequestRow[] = (dqRows ?? []).map((r) => {
		const sheet = (r.scoresheets as unknown) as {
			participant_id: string;
			participants: { full_name: string; category: 'A' | 'B' | 'C' };
		};
		const judge = (r.profiles as unknown) as { full_name: string };
		return {
			id: r.id as string,
			scoresheetId: r.scoresheet_id as string,
			participantId: sheet.participant_id,
			participantName: sheet.participants.full_name,
			participantCategory: sheet.participants.category,
			judgeName: judge?.full_name ?? '(unknown)',
			reason: r.reason as string,
			notes: r.notes as string,
			status: r.status as DqRequestRow['status'],
			createdAt: r.created_at as string,
			approvedAt: (r.approved_at as string | null) ?? null,
			deniedAt: (r.denied_at as string | null) ?? null,
			resolutionNote: (r.resolution_note as string | null) ?? null
		};
	});

	return { rows: result, dqRows: dqResult };
};

export const actions: Actions = {
	approve: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null;
		if (!id) return fail(400, { error: 'Missing id.' });

		// Load the request + scoresheet to know which lock to clear.
		const { data: req, error: reqErr } = await supabaseAdmin
			.from('edit_requests')
			.select('id, scoresheet_id, status, requested_by')
			.eq('id', id)
			.single();
		if (reqErr || !req) return fail(404, { error: 'Request not found.' });
		if (req.status !== 'pending') {
			return fail(409, { error: `Already ${req.status}.` });
		}

		const { data: sheet } = await supabaseAdmin
			.from('scoresheets')
			.select('id, status, section_a_submitted_at')
			.eq('id', req.scoresheet_id)
			.single();
		if (!sheet) return fail(404, { error: 'Scoresheet not found.' });

		// Clear whichever lock is in effect. If both, clear the inner one only
		// (status='submitted' implies Section A was done long ago — re-opening
		// the whole sheet is the right move).
		let unlocked: 'section_a' | 'submitted' | 'none' = 'none';
		if (sheet.status === 'submitted' || sheet.status === 'finalised') {
			const { error: shErr } = await supabaseAdmin
				.from('scoresheets')
				.update({ status: 'draft', submitted_at: null, finalised_at: null })
				.eq('id', sheet.id);
			if (shErr) return fail(400, { error: shErr.message });
			unlocked = 'submitted';
		} else if (sheet.section_a_submitted_at) {
			const { error: shErr } = await supabaseAdmin
				.from('scoresheets')
				.update({ section_a_submitted_at: null })
				.eq('id', sheet.id);
			if (shErr) return fail(400, { error: shErr.message });
			unlocked = 'section_a';
		}

		const { error: stampErr } = await supabaseAdmin
			.from('edit_requests')
			.update({
				status: 'approved',
				resolved_at: new Date().toISOString(),
				resolved_by: session.user.id,
				resolved_note: note
			})
			.eq('id', id);
		if (stampErr) return fail(400, { error: stampErr.message });

		await appendAudit({
			actor: actorFromSession(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'scoresheet_unlock',
			targetType: 'scoresheet',
			targetId: sheet.id,
			before: {
				status: sheet.status,
				section_a_submitted_at: sheet.section_a_submitted_at
			},
			after: { unlocked },
			reason: `Approved edit request: ${note ?? '(no note)'}`
		});

		return { ok: true, message: 'Edit access granted.' };
	},

	deny: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null;
		if (!id) return fail(400, { error: 'Missing id.' });

		const { data: req } = await supabaseAdmin
			.from('edit_requests')
			.select('id, scoresheet_id, status')
			.eq('id', id)
			.single();
		if (!req) return fail(404, { error: 'Request not found.' });
		if (req.status !== 'pending') {
			return fail(409, { error: `Already ${req.status}.` });
		}

		const { error: stampErr } = await supabaseAdmin
			.from('edit_requests')
			.update({
				status: 'denied',
				resolved_at: new Date().toISOString(),
				resolved_by: session.user.id,
				resolved_note: note
			})
			.eq('id', id);
		if (stampErr) return fail(400, { error: stampErr.message });

		await appendAudit({
			actor: actorFromSession(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'user_update',
			targetType: 'scoresheet',
			targetId: req.scoresheet_id as string,
			before: null,
			after: { denied_edit_request: id },
			reason: `Denied edit request: ${note ?? '(no note)'}`
		});

		return { ok: true, message: 'Request denied.' };
	},

	approveDq: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null;
		if (!id) return fail(400, { error: 'Missing id.' });

		const { data: dq } = await supabaseAdmin
			.from('disqualifications')
			.select('id, scoresheet_id, status, scoresheets!inner(participant_id)')
			.eq('id', id)
			.single();
		if (!dq) return fail(404, { error: 'Disqualification not found.' });
		if (dq.status !== 'pending') return fail(409, { error: `Already ${dq.status}.` });

		const sheet = (dq.scoresheets as unknown) as { participant_id: string };

		// Mark the participant as disqualified — the leaderboard / results
		// queries filter on participants.qualified.
		const { error: pErr } = await supabaseAdmin
			.from('participants')
			.update({ qualified: false })
			.eq('id', sheet.participant_id);
		if (pErr) return fail(400, { error: pErr.message });

		const { error: stampErr } = await supabaseAdmin
			.from('disqualifications')
			.update({
				status: 'approved',
				approved_at: new Date().toISOString(),
				approved_by: session.user.id,
				resolution_note: note
			})
			.eq('id', id);
		if (stampErr) return fail(400, { error: stampErr.message });

		await appendAudit({
			actor: actorFromSession(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'dq_flag_raise',
			targetType: 'dq_flag',
			targetId: id,
			before: { status: 'pending' },
			after: { status: 'approved', participant_qualified: false },
			reason: `Approved disqualification: ${note ?? '(no note)'}`
		});

		return { ok: true, message: 'Disqualification approved.' };
	},

	denyDq: async ({ request, locals, getClientAddress }) => {
		const session = await requireSuperAdmin(locals.user);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null;
		if (!id) return fail(400, { error: 'Missing id.' });

		const { data: dq } = await supabaseAdmin
			.from('disqualifications')
			.select('id, status')
			.eq('id', id)
			.single();
		if (!dq) return fail(404, { error: 'Disqualification not found.' });
		if (dq.status !== 'pending') return fail(409, { error: `Already ${dq.status}.` });

		const { error: stampErr } = await supabaseAdmin
			.from('disqualifications')
			.update({
				status: 'denied',
				denied_at: new Date().toISOString(),
				denied_by: session.user.id,
				resolution_note: note
			})
			.eq('id', id);
		if (stampErr) return fail(400, { error: stampErr.message });

		await appendAudit({
			actor: actorFromSession(session),
			actorIp: getClientAddress(),
			actorUa: request.headers.get('user-agent'),
			action: 'dq_flag_clear',
			targetType: 'dq_flag',
			targetId: id,
			before: { status: 'pending' },
			after: { status: 'denied' },
			reason: `Denied disqualification: ${note ?? '(no note)'}`
		});

		return { ok: true, message: 'Disqualification denied.' };
	}
};
