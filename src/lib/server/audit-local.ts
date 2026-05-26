// Local audit log — JSON Lines file stored on the Pi.
//
// The DB-side audit_log table was retired in migration 013 to keep Supabase
// free-tier storage usable for an indefinite number of events. Audit data
// now lives next to the Pi where the app runs and where Mohammad reviews it
// post-event from /admin/audit. Backups: just copy the .jsonl file off the
// Pi (USB stick, scp, whatever).
//
// File format: one JSON object per line, append-only. The shape matches the
// `AuditRowWithActor` returned by the old Supabase query module so the UI
// components (AuditTable, JsonDiff, etc.) didn't need to change.
//
// Each writer call resolves the actor inline (name + email + role captured
// from the guard return value) so the reader never has to join to profiles.

import { existsSync, mkdirSync, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

import type { AuditAction, TargetType } from '$lib/audit/types';
import type { AuditFilters, AuditRowWithActor } from '$lib/audit/query';

// ─── Storage location ────────────────────────────────────────────────────────
// Override via AUDIT_LOG_PATH env var on the Pi. Default puts the file under
// the user's home dir so a `git pull` or `pnpm install` can never wipe it.

function resolveLogPath(): string {
	const fromEnv = process.env.AUDIT_LOG_PATH?.trim();
	if (fromEnv) return fromEnv;
	return join(homedir(), '.p3-judging', 'audit.jsonl');
}

export const AUDIT_LOG_PATH = resolveLogPath();

function ensureParentDir(path: string): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ─── Writer ──────────────────────────────────────────────────────────────────

export type AuditActor = {
	id: string | null;
	role: 'super_admin' | 'judge' | 'viewer' | 'registration_committee' | null;
	fullName: string | null;
	email: string | null;
};

export type AppendAuditInput = {
	actor: AuditActor;
	actorIp?: string | null;
	actorUa?: string | null;
	action: AuditAction;
	targetType: TargetType | string | null;
	targetId: string | null;
	before?: Record<string, unknown> | null;
	after?: Record<string, unknown> | null;
	reason?: string | null;
};

type StoredRow = {
	id: string;
	at: string;
	actor_id: string | null;
	actor_role: AuditActor['role'];
	actor_name: string | null;
	actor_email: string | null;
	actor_ip: string | null;
	actor_ua: string | null;
	action: AuditAction;
	target_type: string | null;
	target_id: string | null;
	before_json: Record<string, unknown> | null;
	after_json: Record<string, unknown> | null;
	reason: string | null;
};

export async function appendAudit(input: AppendAuditInput): Promise<void> {
	const row: StoredRow = {
		id: randomUUID(),
		at: new Date().toISOString(),
		actor_id: input.actor.id,
		actor_role: input.actor.role,
		actor_name: input.actor.fullName,
		actor_email: input.actor.email,
		actor_ip: input.actorIp ?? null,
		actor_ua: input.actorUa ?? null,
		action: input.action,
		target_type: (input.targetType as string | null) ?? null,
		target_id: input.targetId,
		before_json: input.before ?? null,
		after_json: input.after ?? null,
		reason: input.reason ?? null
	};

	try {
		ensureParentDir(AUDIT_LOG_PATH);
		await fs.appendFile(AUDIT_LOG_PATH, JSON.stringify(row) + '\n', 'utf8');
	} catch (err) {
		// Audit failure must never block the actual user action. Log to stderr
		// so it lands in journalctl / the operator's terminal, and move on.
		console.error('[audit] failed to append row:', err);
	}
}

// ─── Reader ──────────────────────────────────────────────────────────────────

type NonNullActorRole = NonNullable<AuditRowWithActor['actor_role']>;

function storedToView(row: StoredRow): AuditRowWithActor {
	return {
		id: row.id,
		at: row.at,
		actor_id: row.actor_id,
		actor_role: row.actor_role,
		actor: row.actor_id
			? {
					full_name: row.actor_name ?? '(unknown)',
					role: (row.actor_role ?? 'judge') as NonNullActorRole,
					email: row.actor_email ?? undefined
				}
			: null,
		actor_ip: row.actor_ip,
		actor_ua: row.actor_ua,
		action: row.action,
		target_type: row.target_type,
		target_id: row.target_id,
		before_json: row.before_json,
		after_json: row.after_json,
		reason: row.reason
	};
}

function matchesFilters(row: StoredRow, f: AuditFilters): boolean {
	if (f.actorIds.length && (!row.actor_id || !f.actorIds.includes(row.actor_id))) return false;
	if (f.actions.length && !f.actions.includes(row.action)) return false;
	if (f.targetTypes.length && (!row.target_type || !f.targetTypes.includes(row.target_type)))
		return false;
	if (f.fromIso && row.at < f.fromIso) return false;
	if (f.toIso && row.at > f.toIso) return false;
	if (f.search) {
		const needle = f.search.toLowerCase();
		const hay =
			((row.reason ?? '') + ' ' + (row.target_id ?? '')).toLowerCase();
		if (!hay.includes(needle)) return false;
	}
	return true;
}

function byNewestFirst(a: StoredRow, b: StoredRow): number {
	if (a.at > b.at) return -1;
	if (a.at < b.at) return 1;
	return 0;
}

async function readAllRows(): Promise<StoredRow[]> {
	let text: string;
	try {
		text = await fs.readFile(AUDIT_LOG_PATH, 'utf8');
	} catch (err) {
		// ENOENT — no events yet. Return empty list.
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw err;
	}
	const out: StoredRow[] = [];
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			out.push(JSON.parse(trimmed) as StoredRow);
		} catch {
			// Skip malformed lines — happens if a crash truncated mid-write.
		}
	}
	return out;
}

/**
 * Limit-only read scoped by RLS-equivalent rules.
 *   - super_admin + viewer: full read
 *   - judge: only their own rows
 *   - registration_committee: only their own rows
 * Caller passes `restrictToActorId` (= auth.uid()) for the non-admin paths.
 */
export async function fetchAuditPage(
	f: AuditFilters,
	limit: number,
	restrictToActorId: string | null = null
): Promise<{ rows: AuditRowWithActor[]; error: string | null }> {
	try {
		const all = await readAllRows();
		const filtered = all.filter((r) => {
			if (restrictToActorId && r.actor_id !== restrictToActorId) return false;
			return matchesFilters(r, f);
		});
		// Newest first (the file is append-only / chronological).
		filtered.sort(byNewestFirst);
		const page = filtered.slice(0, limit).map(storedToView);
		return { rows: page, error: null };
	} catch (err) {
		return {
			rows: [],
			error: err instanceof Error ? err.message : String(err)
		};
	}
}

/** Stream every matching row in newest-first order for CSV export. */
export async function* streamAuditRows(
	f: AuditFilters,
	restrictToActorId: string | null = null
): AsyncGenerator<AuditRowWithActor> {
	const all = await readAllRows();
	const filtered = all.filter((r) => {
		if (restrictToActorId && r.actor_id !== restrictToActorId) return false;
		return matchesFilters(r, f);
	});
	filtered.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
	for (const row of filtered) yield storedToView(row);
}

/** List of distinct actor IDs that appear in the log (for the filter dropdown). */
export async function distinctActors(): Promise<
	{ id: string; fullName: string; role: AuditActor['role']; email: string | null }[]
> {
	const all = await readAllRows();
	const map = new Map<string, { id: string; fullName: string; role: AuditActor['role']; email: string | null }>();
	for (const r of all) {
		if (!r.actor_id || map.has(r.actor_id)) continue;
		map.set(r.actor_id, {
			id: r.actor_id,
			fullName: r.actor_name ?? '(unknown)',
			role: r.actor_role,
			email: r.actor_email
		});
	}
	return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
}
