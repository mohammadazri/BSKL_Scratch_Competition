// CSV builders for Track 5 exports.
//
// Two flavours:
//   1. Leaderboard CSV — one row per participant, all categories. Used by the
//      Export CSV button on /admin/results and /viewer/results.
//   2. Per-scoresheet CSV — full criterion breakdown. Used from the drill-in
//      pages.
//
// Both use RFC 4180-ish escaping + UTF-8 BOM so Excel picks up the encoding.

import type { RankingRow, ScoresheetDetail } from './types';

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

function joinCsv(rows: string[][]): string {
	// UTF-8 BOM + CRLF lines, per audit/csv.ts convention.
	const BOM = '﻿';
	return BOM + rows.map((r) => r.map(escapeField).join(',')).join('\r\n') + '\r\n';
}

/** Filename: p3-results-YYYY-MM-DD-HHMM.csv (per TRACK_5_RESULTS.md). */
export function resultsFilename(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const y = now.getFullYear();
	const m = pad(now.getMonth() + 1);
	const d = pad(now.getDate());
	const hh = pad(now.getHours());
	const mm = pad(now.getMinutes());
	return `p3-results-${y}-${m}-${d}-${hh}${mm}.csv`;
}

/** Filename for per-scoresheet export. */
export function scoresheetFilename(
	detail: Pick<ScoresheetDetail, 'participantName' | 'category'>,
	now = new Date()
): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const y = now.getFullYear();
	const m = pad(now.getMonth() + 1);
	const d = pad(now.getDate());
	const slug = detail.participantName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 32);
	return `p3-scoresheet-${detail.category}-${slug}-${y}-${m}-${d}.csv`;
}

/** Leaderboard export — one row per participant. */
export function rankingRowsToCsv(rows: RankingRow[]): string {
	const headers = [
		'rank',
		'category',
		'participant_name',
		'school_name',
		'theme',
		'total_score',
		'live_sprint_time_seconds',
		'status',
		'qualified',
		'judge_email',
		'submitted_at'
	];

	// Sort by category, then rank (NULLs last) so the file reads top-to-bottom.
	const sorted = [...rows].sort((a, b) => {
		if (a.category !== b.category) return a.category.localeCompare(b.category);
		const ar = a.rank ?? Number.POSITIVE_INFINITY;
		const br = b.rank ?? Number.POSITIVE_INFINITY;
		return ar - br;
	});

	const out: string[][] = [headers];
	for (const r of sorted) {
		out.push([
			r.rank == null ? '' : String(r.rank),
			r.category,
			r.participantName,
			r.schoolName,
			r.theme ?? '',
			r.totalPoints == null ? '' : String(r.totalPoints),
			r.liveSprintTimeSeconds == null ? '' : String(r.liveSprintTimeSeconds),
			r.scoresheetStatus,
			r.qualified ? 'true' : 'false',
			r.judgeEmail ?? '',
			r.submittedAt ?? ''
		]);
	}
	return joinCsv(out);
}

/** Per-scoresheet export — one row per criterion. */
export function scoresheetToCsv(detail: ScoresheetDetail): string {
	const headers = [
		'participant_name',
		'school_name',
		'category',
		'theme',
		'judge_name',
		'judge_email',
		'status',
		'submitted_at',
		'live_sprint_time_seconds',
		'section',
		'criterion_name',
		'sort_order',
		'level',
		'points',
		'max_points',
		'comment',
		'is_override',
		'override_reason'
	];

	const out: string[][] = [headers];
	for (const section of detail.sections) {
		for (const s of section.scores) {
			out.push([
				detail.participantName,
				detail.schoolName,
				detail.category,
				detail.theme ?? '',
				detail.judgeName,
				detail.judgeEmail,
				detail.status,
				detail.submittedAt ?? '',
				detail.liveSprintTimeSeconds == null
					? ''
					: String(detail.liveSprintTimeSeconds),
				section.section,
				s.criterionName,
				String(s.sortOrder),
				s.level ?? '',
				s.points == null ? '' : String(s.points),
				String(s.maxPoints),
				s.comment ?? '',
				s.isOverride ? 'true' : 'false',
				s.overrideReason ?? ''
			]);
		}
	}
	return joinCsv(out);
}
