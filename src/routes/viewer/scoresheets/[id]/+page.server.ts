// /viewer/scoresheets/[id] — read-only drill-in for viewer role.
// No actions exposed — viewer cannot override or unlock anything.
// Role guard runs in /viewer/+layout.server.ts (viewer + super_admin).

import type { PageServerLoad } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import type { ScoresheetPageData } from '$lib/results/types';

export const load: PageServerLoad = async ({ locals, params }): Promise<ScoresheetPageData> => {
	const { detail, error: err } = await fetchScoresheetDetail(locals.supabase, params.id);
	return {
		detail,
		role: 'viewer',
		loadError: err
	};
};
