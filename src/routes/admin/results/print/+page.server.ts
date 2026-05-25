// /admin/results/print — print-friendly podium page for super_admin.
// Renders top 3 per category, optimised for paper output (@media print).
// Filters apply (e.g. ?category=B prints just Cat B).

import type { PageServerLoad } from './$types';
import { parseResultsFilters, fetchRankings } from '$lib/results/query';
import type { Category } from '$lib/types';
import type { RankingRow } from '$lib/results/types';

export type PodiumGroup = {
	category: Category;
	winners: RankingRow[]; // top 3
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = parseResultsFilters(url.searchParams);
	const { rows, error } = await fetchRankings(locals.supabase, filters);

	const byCategory = new Map<Category, RankingRow[]>();
	for (const r of rows) {
		if (r.rank == null || r.rank > 3) continue;
		const arr = byCategory.get(r.category) ?? [];
		arr.push(r);
		byCategory.set(r.category, arr);
	}

	const groups: PodiumGroup[] = (['A', 'B', 'C'] as Category[])
		.filter((c) => byCategory.has(c))
		.map((c) => ({ category: c, winners: byCategory.get(c) ?? [] }));

	return { groups, loadError: error };
};
