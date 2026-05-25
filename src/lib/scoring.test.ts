// Vitest coverage for the scoring helpers. These are the workhorse functions
// that gate auto-fill, band clamping, and time-input safety — if they regress
// the form quietly ships invalid data to the DB trigger.

import { describe, expect, it } from 'vitest';
import {
	clampToLevel,
	formatMmSs,
	levelForPoints,
	midpoint,
	secondsToTime,
	sortLevels,
	timeToSeconds,
	type RubricLevel
} from './scoring';

const excellent: RubricLevel = {
	id: 'l-e',
	level: 'Excellent',
	minPts: 14,
	maxPts: 16,
	descriptor: 'top'
};
const proficient: RubricLevel = {
	id: 'l-p',
	level: 'Proficient',
	minPts: 10,
	maxPts: 13,
	descriptor: 'mid'
};
const developing: RubricLevel = {
	id: 'l-d',
	level: 'Developing',
	minPts: 4,
	maxPts: 9,
	descriptor: 'low'
};
const insufficient: RubricLevel = {
	id: 'l-i',
	level: 'Insufficient',
	minPts: 0,
	maxPts: 3,
	descriptor: 'none'
};

// Cat A Section B "Sprite Added Correctly" has only 3 levels — no Developing.
const sprite3: RubricLevel[] = [
	{ id: 's-e', level: 'Excellent', minPts: 6, maxPts: 6, descriptor: 'a' },
	{ id: 's-p', level: 'Proficient', minPts: 3, maxPts: 5, descriptor: 'b' },
	{ id: 's-i', level: 'Insufficient', minPts: 0, maxPts: 2, descriptor: 'c' }
];

const fourLevels: RubricLevel[] = [excellent, proficient, developing, insufficient];

describe('midpoint', () => {
	it('rounds to nearest int', () => {
		expect(midpoint({ minPts: 14, maxPts: 16 })).toBe(15);
		expect(midpoint({ minPts: 0, maxPts: 3 })).toBe(2);
		expect(midpoint({ minPts: 6, maxPts: 6 })).toBe(6); // single-point band
	});
});

describe('levelForPoints', () => {
	it('matches the band containing the value', () => {
		expect(levelForPoints(15, fourLevels)?.level).toBe('Excellent');
		expect(levelForPoints(11, fourLevels)?.level).toBe('Proficient');
		expect(levelForPoints(5, fourLevels)?.level).toBe('Developing');
		expect(levelForPoints(0, fourLevels)?.level).toBe('Insufficient');
	});

	it('handles the 3-level sprite band gracefully', () => {
		expect(levelForPoints(6, sprite3)?.level).toBe('Excellent');
		expect(levelForPoints(4, sprite3)?.level).toBe('Proficient');
		expect(levelForPoints(1, sprite3)?.level).toBe('Insufficient');
	});

	it('returns null when no band matches (shouldn’t happen with contiguous data)', () => {
		expect(levelForPoints(99, fourLevels)).toBeNull();
	});
});

describe('clampToLevel', () => {
	it('keeps the value inside the band', () => {
		expect(clampToLevel(20, excellent)).toBe(16); // above
		expect(clampToLevel(-5, insufficient)).toBe(0); // below
		expect(clampToLevel(12, proficient)).toBe(12); // inside
	});

	it('handles non-finite input by falling back to min', () => {
		expect(clampToLevel(Number.NaN, proficient)).toBe(10);
	});
});

describe('sortLevels', () => {
	it('orders best → worst regardless of input order', () => {
		const shuffled = [insufficient, excellent, proficient, developing];
		const ordered = sortLevels(shuffled).map((l) => l.level);
		expect(ordered).toEqual(['Excellent', 'Proficient', 'Developing', 'Insufficient']);
	});

	it('works for the 3-level shape too', () => {
		const ordered = sortLevels([sprite3[2], sprite3[0], sprite3[1]]).map((l) => l.level);
		expect(ordered).toEqual(['Excellent', 'Proficient', 'Insufficient']);
	});
});

describe('time helpers', () => {
	it('round-trips mm:ss → seconds', () => {
		expect(timeToSeconds(41, 27)).toBe(41 * 60 + 27);
		expect(timeToSeconds(0, 0)).toBe(0);
		expect(timeToSeconds(45, 0)).toBe(2700);
	});

	it('rejects out-of-range values', () => {
		expect(timeToSeconds(46, 0)).toBeNull(); // above 45-min cap
		expect(timeToSeconds(0, 60)).toBeNull(); // seconds must be 0-59
		expect(timeToSeconds(-1, 0)).toBeNull();
	});

	it('converts seconds → padded mm:ss strings', () => {
		expect(formatMmSs(0)).toBe('00:00');
		expect(formatMmSs(75)).toBe('01:15');
		expect(formatMmSs(2700)).toBe('45:00');
		expect(formatMmSs(null)).toBe('00:00');
	});

	it('secondsToTime caps at 45:00', () => {
		expect(secondsToTime(99999)).toEqual({ minutes: 45, seconds: 0 });
	});
});
