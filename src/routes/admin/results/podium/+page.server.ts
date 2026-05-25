// /admin/results/podium — print-friendly category podium.
// One <section class="page"> per category, page-break-after to land each
// podium on its own printed page. Filters from the parent results page
// (e.g. ?category=B) flow through.

import type { PageServerLoad } from './$types';
import { parseResultsFilters, fetchRankings } from '$lib/results/query';
import type { RankingRow } from '$lib/results/types';
import type { Category } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = parseResultsFilters(url.searchParams);
	const { rows } = await fetchRankings(locals.supabase, filters);

	// Group by category, take top 3 with a valid rank.
	const byCategory = new Map<Category, RankingRow[]>();
	for (const r of rows) {
		if (!r.qualified) continue;
		if (r.rank == null || r.rank > 3) continue;
		const arr = byCategory.get(r.category) ?? [];
		arr.push(r);
		byCategory.set(r.category, arr);
	}

	// Stable order: A then B then C.
	const podiums = (['A', 'B', 'C'] as const)
		.filter((c) => byCategory.has(c))
		.map((c) => ({ category: c, rows: byCategory.get(c)! }));

	return { podiums };
};
