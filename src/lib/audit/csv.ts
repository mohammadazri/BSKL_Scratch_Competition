// CSV encoder + streaming response builder for audit log export.
//
// Goals:
//   • Stream — never materialise the full result set in memory. We accept an
//     AsyncIterable<row> and pipe rows through an encoder TransformStream.
//   • Correct Excel handling — UTF-8 BOM prefix, CRLF line endings, RFC 4180
//     escaping (quote fields containing comma, quote, or newline; double any
//     inner quotes).
//   • Stable column order matching the spec in TRACK_4_AUDIT.md.

import type { AuditRowWithActor } from './query';

const COLUMNS = [
	'at',
	'actor_email',
	'actor_name',
	'actor_role',
	'action',
	'target_type',
	'target_id',
	'reason',
	'before_json',
	'after_json',
	'actor_ip',
	'actor_user_agent'
] as const;

// RFC 4180-ish CSV field escape.
function escapeField(value: unknown): string {
	if (value === null || value === undefined) return '';
	let s: string;
	if (typeof value === 'string') s = value;
	else if (typeof value === 'object') s = JSON.stringify(value);
	else s = String(value);

	const needsQuoting = /[",\r\n]/.test(s);
	if (!needsQuoting) return s;
	return `"${s.replace(/"/g, '""')}"`;
}

function rowToCsvFields(r: AuditRowWithActor): string[] {
	return [
		r.at,
		(r as any).actor?.email ?? '',
		r.actor?.full_name ?? (r.actor_id === null ? 'System' : ''),
		r.actor?.role ?? r.actor_role ?? '',
		r.action,
		r.target_type ?? '',
		r.target_id ?? '',
		r.reason ?? '',
		r.before_json === null ? '' : JSON.stringify(r.before_json),
		r.after_json === null ? '' : JSON.stringify(r.after_json),
		r.actor_ip ?? '',
		r.actor_ua ?? ''
	];
}

// Stream rows into a CSV-encoded Response body.
// Uses the standard ReadableStream API — works in SvelteKit's Node adapter.
export function streamRowsToCsv(rows: AsyncIterable<AuditRowWithActor>): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	// UTF-8 BOM so Excel auto-detects encoding (avoids garbled non-ASCII names).
	const BOM = encoder.encode('﻿');
	const header = encoder.encode(COLUMNS.join(',') + '\r\n');

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			controller.enqueue(BOM);
			controller.enqueue(header);
			try {
				for await (const r of rows) {
					const line = rowToCsvFields(r).map(escapeField).join(',') + '\r\n';
					controller.enqueue(encoder.encode(line));
				}
				controller.close();
			} catch (err) {
				controller.error(err);
			}
		}
	});
}

// Filename: audit-YYYY-MM-DD-HHMM.csv (per spec).
export function exportFilename(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const y = now.getFullYear();
	const m = pad(now.getMonth() + 1);
	const d = pad(now.getDate());
	const hh = pad(now.getHours());
	const mm = pad(now.getMinutes());
	return `audit-${y}-${m}-${d}-${hh}${mm}.csv`;
}
