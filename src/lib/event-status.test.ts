import { describe, expect, it } from 'vitest';
import {
	deriveCategoryEventStatus,
	formatEventDuration,
	mapEventStateRow,
	parseMalaysiaDateTimeInput,
	toMalaysiaDateTimeInput,
	type EventSnapshot
} from './event-status';

const base: EventSnapshot = {
	eventName: 'Test event',
	eventDate: '2026-07-25',
	sprintMinutes: 45,
	phases: { A: 'setup', B: 'section_a', C: 'section_b' },
	sprintStarts: { A: null, B: '2026-07-25T02:00:00.000Z', C: '2026-07-25T02:00:00.000Z' },
	locked: false
};

describe('event status', () => {
	it('maps database rows and supplies safe defaults', () => {
		expect(mapEventStateRow({ phase_a: 'section_a', sprint_minutes: 60 })).toMatchObject({
			sprintMinutes: 60,
			phases: { A: 'section_a', B: 'setup', C: 'setup' },
			locked: false
		});
	});

	it('shows a scheduled countdown before the configured start', () => {
		const status = deriveCategoryEventStatus(base, 'B', Date.parse('2026-07-25T01:30:00Z'));
		expect(status).toMatchObject({ mode: 'scheduled', timerLabel: 'Starts in' });
		expect(status.remainingMs).toBe(30 * 60_000);
	});

	it('waits for the admin when the timestamp arrives before Section B opens', () => {
		const status = deriveCategoryEventStatus(base, 'B', Date.parse('2026-07-25T02:01:00Z'));
		expect(status).toMatchObject({ mode: 'waiting', timerLabel: 'Awaiting admin' });
	});

	it('counts down the active sprint and then marks it elapsed', () => {
		const active = deriveCategoryEventStatus(base, 'C', Date.parse('2026-07-25T02:10:00Z'));
		expect(active).toMatchObject({ mode: 'running', remainingMs: 35 * 60_000 });

		const elapsed = deriveCategoryEventStatus(base, 'C', Date.parse('2026-07-25T03:00:00Z'));
		expect(elapsed).toMatchObject({ mode: 'elapsed', remainingMs: 0 });
	});

	it('lets finalised override any configured clock', () => {
		const event = { ...base, phases: { ...base.phases, C: 'finalised' as const } };
		expect(deriveCategoryEventStatus(event, 'C', Date.now()).mode).toBe('finalised');
	});

	it('formats clocks with stable tabular values', () => {
		expect(formatEventDuration(5 * 60_000 + 9_000)).toBe('05:09');
		expect(formatEventDuration(2 * 3_600_000 + 3 * 60_000 + 4_000)).toBe('02:03:04');
	});

	it('round-trips Malaysia-local admin timer values', () => {
		const parsed = parseMalaysiaDateTimeInput('2026-07-25T10:30');
		expect(parsed).toEqual({ iso: '2026-07-25T02:30:00.000Z', error: null });
		expect(toMalaysiaDateTimeInput(parsed.iso)).toBe('2026-07-25T10:30');
		expect(parseMalaysiaDateTimeInput('2026-02-30T10:30').error).toBeTruthy();
	});
});
