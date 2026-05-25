// /viewer/scoresheets/[id] — read-only drill-in for observers.
// No form actions — viewer role has no INSERT/UPDATE policies. Even if a stray
// POST landed here it would be rejected by RLS.

import type { PageServerLoad } from './$types';
import { fetchScoresheetDetail } from '$lib/results/scoresheet';
import type { ScoresheetPageData } from '$lib/results/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { detail, error: err } = await fetchScoresheetDetail(
		locals.supabase,
		params.id
	);
	return {
		detail,
		role: 'viewer' as const,
		loadError: err
	} satisfies ScoresheetPageData;
};
