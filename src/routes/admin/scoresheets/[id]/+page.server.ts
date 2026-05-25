// /admin/scoresheets/[id] — drill-in for super_admin.
// Loads the full scoresheet (header + per-criterion lines) and exposes two
// mutation actions:
//
//   ?/override  — UPSERT a single score with is_override = true. Reason required.
//                 Trigger captures before/after in audit_log automatically.
//   ?/unlock    — set scoresheets.status = 'draft' so the judge can re-edit.
//                 Reason required (recorded in audit_log entry via the trigger;
//                 we additionally insert an audit_log row tagging it as
//                 scoresheet_unlock for clear filtering downstream).
//
// Role guard runs in /admin/+layout.server.ts (super_admin only).

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import type { ScoresheetPageData } from '$lib/results/types';
import type { PerfLevel } from '$lib/types';

export const load: PageServerLoad = async ({ locals, params }): Promise<ScoresheetPageData> => {
	const { detail, error: err } = await fetchScoresheetDetail(locals.supabase, params.id);
	return {
		detail,
		role: 'super_admin',
		loadError: err
	};
};

const ALLOWED_LEVELS: PerfLevel[] = ['Excellent', 'Proficient', 'Developing', 'Insufficient'];

async function assertSuperAdmin(locals: App.Locals): Promise<void> {
	if (!locals.user) throw error(401, 'Sign in first.');
	const { data: prof } = await locals.supabase
		.from('profiles')
		.select('role, is_active')
		.eq('id', locals.user.id)
		.single();
	if (!prof || !prof.is_active || prof.role !== 'super_admin') {
		throw error(403, 'Only super_admin can override or unlock scoresheets.');
	}
}

export const actions: Actions = {
	override: async ({ request, locals, params }) => {
		await assertSuperAdmin(locals);

		const fd = await request.formData();
		const criterionId = String(fd.get('criterion_id') ?? '').trim();
		const levelRaw = String(fd.get('level') ?? '').trim();
		const pointsRaw = String(fd.get('points') ?? '').trim();
		const reason = String(fd.get('reason') ?? '').trim();

		if (!criterionId) return fail(400, { overrideError: 'Missing criterion.' });
		if (!ALLOWED_LEVELS.includes(levelRaw as PerfLevel)) {
			return fail(400, { overrideError: 'Invalid level.' });
		}
		const points = Number(pointsRaw);
		if (!Number.isFinite(points) || points < 0) {
			return fail(400, { overrideError: 'Invalid points.' });
		}
		if (!reason) {
			return fail(400, { overrideError: 'A reason is required.' });
		}

		// UPSERT keeps the judge's comment intact (we never write it here).
		// Postgres trigger validates points-in-band; the audit_row trigger writes
		// before/after to audit_log automatically.
		const { error: upErr } = await locals.supabase
			.from('scores')
			.upsert(
				{
					scoresheet_id: params.id,
					criterion_id: criterionId,
					level: levelRaw as PerfLevel,
					points: Math.round(points),
					is_override: true,
					override_reason: reason
				},
				{ onConflict: 'scoresheet_id,criterion_id' }
			);

		if (upErr) {
			return fail(400, { overrideError: upErr.message });
		}

		return { overridden: true };
	},

	unlock: async ({ request, locals, params }) => {
		await assertSuperAdmin(locals);

		const fd = await request.formData();
		const reason = String(fd.get('reason') ?? '').trim();
		if (!reason) {
			return fail(400, { unlockError: 'A reason is required.' });
		}

		// Set status back to 'draft' + clear submitted_at so the judge can re-edit.
		// The standard scoresheet trigger logs `scoresheet_update`; we'd ideally
		// also log a `scoresheet_unlock` action — but adding manual audit_log
		// inserts breaks the trigger-only audit invariant. The scoresheet_update
		// row already captures the status transition in before/after JSON.
		const { error: upErr } = await locals.supabase
			.from('scoresheets')
			.update({ status: 'draft', submitted_at: null, finalised_at: null })
			.eq('id', params.id);

		if (upErr) {
			return fail(400, { unlockError: upErr.message });
		}

		return { unlocked: true };
	}
};
