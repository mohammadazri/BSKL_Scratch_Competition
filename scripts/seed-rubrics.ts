/**
 * scripts/seed-rubrics.ts
 *
 * Idempotent loader that reads `supabase/seed/rubrics.json` (the source of
 * truth for all rubric reference data) and upserts rows into `criteria` and
 * `criterion_levels`.
 *
 * Run with:
 *   pnpm tsx scripts/seed-rubrics.ts
 *
 * Requires DATABASE_URL in .env (direct postgres connection — bypasses RLS as
 * the database superuser, which is required to write seed data).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import 'dotenv/config';

type Level = {
	level: 'Excellent' | 'Proficient' | 'Developing' | 'Insufficient';
	min_pts: number;
	max_pts: number;
	descriptor: string;
};

type Checkpoint = {
	id: string;
	sort_order: number;
	points: number;
	label: string;
};

type Criterion = {
	sort_order: number;
	name: string;
	max_points: number;
	checkpoints?: Checkpoint[];
	levels: Level[];
};

type Section = {
	section: 'A' | 'B';
	criteria: Criterion[];
};

type CategoryBlock = {
	category: 'A' | 'B' | 'C';
	sections: Section[];
};

type Rubrics = {
	categories: CategoryBlock[];
};

async function main() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		throw new Error('DATABASE_URL is not set. Add it to .env (see .env.example).');
	}

	const seedPath = resolve(process.cwd(), 'supabase/seed/rubrics.json');
	const data = JSON.parse(readFileSync(seedPath, 'utf8')) as Rubrics;

	const sql = postgres(dbUrl, { prepare: false });

	let criteriaCount = 0;
	let levelCount = 0;

	try {
		for (const cat of data.categories) {
			for (const sec of cat.sections) {
				for (const crit of sec.criteria) {
					// Sanity: checkpoint points must sum to the criterion's max_points,
					// otherwise the UI shows a score the judge can't actually reach.
					if (crit.checkpoints) {
						const sum = crit.checkpoints.reduce((acc, cp) => acc + cp.points, 0);
						if (sum !== crit.max_points) {
							throw new Error(
								`Checkpoint sum (${sum}) != max_points (${crit.max_points}) for ` +
									`Cat ${cat.category} Section ${sec.section} criterion #${crit.sort_order} "${crit.name}"`
							);
						}
					}

					const checkpointsJson = crit.checkpoints ? JSON.stringify(crit.checkpoints) : null;

					const rows = await sql<{ id: string }[]>`
						INSERT INTO criteria (category, section, name, max_points, sort_order, checkpoints)
						VALUES (
							${cat.category},
							${sec.section},
							${crit.name},
							${crit.max_points},
							${crit.sort_order},
							${checkpointsJson}::jsonb
						)
						ON CONFLICT (category, section, sort_order)
						DO UPDATE SET
							name        = EXCLUDED.name,
							max_points  = EXCLUDED.max_points,
							checkpoints = EXCLUDED.checkpoints
						RETURNING id
					`;
					const criterionId = rows[0].id;
					criteriaCount += 1;

					for (const lvl of crit.levels) {
						await sql`
							INSERT INTO criterion_levels (criterion_id, level, min_pts, max_pts, descriptor)
							VALUES (
								${criterionId},
								${lvl.level},
								${lvl.min_pts},
								${lvl.max_pts},
								${lvl.descriptor}
							)
							ON CONFLICT (criterion_id, level)
							DO UPDATE SET
								min_pts = EXCLUDED.min_pts,
								max_pts = EXCLUDED.max_pts,
								descriptor = EXCLUDED.descriptor
						`;
						levelCount += 1;
					}
				}
			}
		}

		console.log(`seed complete: ${criteriaCount} criteria, ${levelCount} levels upserted`);
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error('seed failed:', err);
	process.exit(1);
});
