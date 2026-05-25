// Scoring-form helpers, browser-safe.
//
// Three responsibilities:
//   - Reshape raw `criteria` + `criterion_levels` rows into the form-friendly
//     `RubricCriterion[]` the scoring UI consumes.
//   - Auto-fill points to the middle of a level's band.
//   - Map a manually-typed points value back to the level whose band contains
//     it (per spec — out-of-band typing re-selects the matching level).

import type { Category, PerfLevel, Section } from './types';

export type RubricLevel = {
	id: string;
	level: PerfLevel;
	minPts: number;
	maxPts: number;
	descriptor: string;
};

export type RubricCriterion = {
	id: string;
	category: Category;
	section: Section;
	name: string;
	maxPoints: number;
	sortOrder: number;
	levels: RubricLevel[]; // ordered Excellent → Insufficient
};

// Stable ordering for performance levels — best to worst.
const LEVEL_ORDER: Record<PerfLevel, number> = {
	Excellent: 0,
	Proficient: 1,
	Developing: 2,
	Insufficient: 3
};

export function sortLevels(levels: RubricLevel[]): RubricLevel[] {
	return [...levels].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

export function midpoint(level: { minPts: number; maxPts: number }): number {
	return Math.round((level.minPts + level.maxPts) / 2);
}

/**
 * Given a points value and a criterion's levels, return the level whose band
 * contains the value, or `null` if none does (shouldn't happen with the
 * contiguous bands in SEED_RUBRICS.md, but we guard anyway).
 */
export function levelForPoints(
	points: number,
	levels: RubricLevel[]
): RubricLevel | null {
	return (
		levels.find((l) => points >= l.minPts && points <= l.maxPts) ?? null
	);
}

/**
 * Clamp a points value into the band of the given level.
 * Used as a last-resort guard so we NEVER ship an out-of-band value to the
 * server (the `check_score_in_band` DB trigger would reject it).
 */
export function clampToLevel(points: number, level: RubricLevel): number {
	if (!Number.isFinite(points)) return level.minPts;
	if (points < level.minPts) return level.minPts;
	if (points > level.maxPts) return level.maxPts;
	return Math.round(points);
}

/** mm:ss → seconds, with sane bounds. Returns null if either part is invalid. */
export function timeToSeconds(minutes: number, seconds: number): number | null {
	if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
	if (minutes < 0 || seconds < 0 || seconds > 59) return null;
	const total = Math.floor(minutes) * 60 + Math.floor(seconds);
	if (total < 0 || total > 2700) return null; // 45:00 hard ceiling per SCHEMA.md
	return total;
}

export function secondsToTime(total: number | null): { minutes: number; seconds: number } {
	if (total == null || !Number.isFinite(total) || total < 0) {
		return { minutes: 0, seconds: 0 };
	}
	const t = Math.min(2700, Math.floor(total));
	return { minutes: Math.floor(t / 60), seconds: t % 60 };
}

export function formatMmSs(total: number | null): string {
	const { minutes, seconds } = secondsToTime(total);
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
