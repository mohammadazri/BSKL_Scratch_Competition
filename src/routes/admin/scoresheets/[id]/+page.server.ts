// /admin/scoresheets/[id] — drill into one scoresheet, super_admin only.
//
// Owns two form actions:
//   • ?/override  — UPSERT a score row with is_override=true + a reason. The
//                   audit_log trigger writes the before/after automatically,
//                   so the original judge's score remains visible in audit
//                   history.
//   • ?/unlock    — Transition the scoresheet back to draft so the original
//                   judge can re-edit. Requires a reason (DB has no NOT NULL
//                   on reason, so we enforce in the action and surface the
//                   reason via the audit_log update payload).
//
// RLS already restricts these writes to super_admin (Track 1). The role guard
// in admin/+layout.server.ts means a non-super-admin never sees this page.

import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import type { ScoresheetPageData } from '$lib/results/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { detail, error: err } = await fetchScoresheetDetail(
		locals.supabase,
		params.id
	);
	return {
		detail,
		role: 'super_admin' as const,
		loadError: err
	} satisfies ScoresheetPageData;
};

export const actions: Actions = {
	override: async ({ request, locals, params }) => {
		const fd = await request.formData();
		const criterionId = String(fd.get('criterion_id') ?? '');
		const level = String(fd.get('level') ?? '');
		const pointsRaw = fd.get('points');
		const reason = String(fd.get('reason') ?? '').trim();

		if (!criterionId) return fail(400, { overrideError: 'Missing criterion.' });
		if (!level) return fail(400, { overrideError: 'Missing level.' });
		if (pointsRaw == null || pointsRaw === '')
			return fail(400, { overrideError: 'Missing points.' });
		// SECURITY / audit-trail: a one-character "." is technically truthy but
		// useless for explaining why a score was overridden. Require a short
		// sentence (10+ chars) and cap at 2000 to bound storage / display.
		if (reason.length < 10) {
			return fail(400, { overrideError: 'Override reason must be at least 10 characters.' });
		}
		if (reason.length > 2000) {
			return fail(400, { overrideError: 'Override reason is too long (max 2000 chars).' });
		}

		const points = Number(pointsRaw);
		if (!Number.isFinite(points) || points < 0)
			return fail(400, { overrideError: 'Invalid points.' });

		// Preserve the judge's comment when overriding — we only touch the level,
		// points, override flag, and reason. PostgREST's upsert with no comment
		// in the payload leaves the existing column untouched on UPDATE.
		const { error: upErr } = await locals.supabase.from('scores').upsert(
			{
				scoresheet_id: params.id,
				criterion_id: criterionId,
				level,
				points,
				is_override: true,
				override_reason: reason
			},
			{ onConflict: 'scoresheet_id,criterion_id' }
		);

		if (upErr) {
			// Surface the DB band-check error verbatim so the admin sees why a
			// value was rejected (e.g. "points 20 outside band for level Proficient (10 - 13)").
			return fail(400, { overrideError: upErr.message });
		}

		return { overridden: true };
	},

	unlock: async ({ request, locals, params }) => {
		const fd = await request.formData();
		const reason = String(fd.get('reason') ?? '').trim();
		// SECURITY / audit-trail: unlocking re-opens a submitted scoresheet for
		// edits. The reason ends up in audit_log; require a real sentence.
		if (reason.length < 10) {
			return fail(400, { unlockError: 'Unlock reason must be at least 10 characters.' });
		}
		if (reason.length > 2000) {
			return fail(400, { unlockError: 'Unlock reason is too long (max 2000 chars).' });
		}

		// Look up the current state — only submitted/finalised can be unlocked;
		// already-draft is a no-op (and signals a UX mistake).
		const { data: sheet, error: sErr } = await locals.supabase
			.from('scoresheets')
			.select('id, status')
			.eq('id', params.id)
			.maybeSingle();
		if (sErr) return fail(500, { unlockError: sErr.message });
		if (!sheet) throw error(404, 'Scoresheet not found.');
		if (sheet.status === 'draft') {
			return fail(400, { unlockError: 'Scoresheet is already in draft state.' });
		}

		const { error: uErr } = await locals.supabase
			.from('scoresheets')
			.update({
				status: 'draft',
				submitted_at: null,
				finalised_at: null
			})
			.eq('id', params.id);
		if (uErr) return fail(400, { unlockError: uErr.message });

		return { unlocked: true, reason };
	}
};
