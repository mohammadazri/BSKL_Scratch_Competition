// POST /admin/assignments/reshuffle-section-b
//
// "Re-shuffle Section B" admin action — every participant gets a DIFFERENT
// judge than their Section A judge for fairness. Same equal-split logic as
// the regular auto-assign, but with a hard "must differ from Section A
// judge" constraint built in.
//
// Body: { category: 'A'|'B'|'C' }
//
// NOTE: This endpoint is also fired automatically when the admin advances
// the event phase to section_b via /admin/event setPhase. Manual invocation
// is for the case where the admin wants to re-shuffle a single category
// (e.g. after correcting a registration).
//
// SECURITY: super_admin only.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSuperAdmin } from '$lib/server/guards';
import { reshuffleSectionBForCategory } from '$lib/server/reshuffle';
import type { Category } from '$lib/types';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireSuperAdmin(locals.user);
	const body = (await request.json().catch(() => null)) as { category?: Category } | null;
	if (!body || !body.category) {
		return json({ ok: false, error: 'Missing category.' }, { status: 400 });
	}

	const result = await reshuffleSectionBForCategory(body.category);
	if (!result.ok) {
		return json(result, { status: 400 });
	}
	return json(result);
};
