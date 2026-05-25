/**
 * scripts/apply-migrations.ts
 *
 * Applies every SQL file in `supabase/migrations/` to the database pointed at
 * by DATABASE_URL, in lexicographic (= numeric) order. Each file is run as one
 * statement via `sql.unsafe(...)` so DO blocks and multi-statement migrations
 * work as written.
 *
 * Run with:
 *   pnpm tsx scripts/apply-migrations.ts
 *
 * All migrations are written to be idempotent, so re-running this script
 * against a partially-set-up DB is safe.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) throw new Error('DATABASE_URL is not set');

	const dir = resolve(process.cwd(), 'supabase/migrations');
	const files = readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	const sql = postgres(dbUrl, { prepare: false, max: 1, ssl: 'require' });

	try {
		for (const f of files) {
			const body = readFileSync(join(dir, f), 'utf8');
			process.stdout.write(`applying ${f} ... `);
			await sql.unsafe(body);
			console.log('ok');
		}
		console.log(`\napplied ${files.length} migration(s)`);
	} finally {
		await sql.end();
	}
}

main().catch((err) => {
	console.error('migration failed:', err);
	process.exit(1);
});
