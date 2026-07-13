import type { Category, EventPhase } from '$lib/types';

export const EVENT_CATEGORIES = ['A', 'B', 'C'] as const satisfies readonly Category[];

export type EventStateDbRow = {
	event_name?: unknown;
	event_date?: unknown;
	sprint_minutes?: unknown;
	phase_a?: unknown;
	phase_b?: unknown;
	phase_c?: unknown;
	sprint_start_a?: unknown;
	sprint_start_b?: unknown;
	sprint_start_c?: unknown;
	locked?: unknown;
};

export type EventSnapshot = {
	eventName: string;
	eventDate: string | null;
	sprintMinutes: number;
	phases: Record<Category, EventPhase>;
	sprintStarts: Record<Category, string | null>;
	locked: boolean;
};

export type CategoryEventStatus = {
	phase: EventPhase;
	mode: 'phase' | 'scheduled' | 'waiting' | 'running' | 'elapsed' | 'finalised';
	title: string;
	timerLabel: string | null;
	remainingMs: number | null;
	tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
};

function normalisePhase(value: unknown): EventPhase {
	if (value === 'section_a' || value === 'section_b' || value === 'finalised') return value;
	return 'setup';
}

function nullableString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null;
}

export function mapEventStateRow(row: EventStateDbRow): EventSnapshot {
	const sprintMinutes = Number(row.sprint_minutes);
	return {
		eventName:
			typeof row.event_name === 'string' && row.event_name.trim()
				? row.event_name
				: 'P3 Future Coders Challenge 2026',
		eventDate: nullableString(row.event_date),
		sprintMinutes: Number.isFinite(sprintMinutes) && sprintMinutes > 0 ? sprintMinutes : 45,
		phases: {
			A: normalisePhase(row.phase_a),
			B: normalisePhase(row.phase_b),
			C: normalisePhase(row.phase_c)
		},
		sprintStarts: {
			A: nullableString(row.sprint_start_a),
			B: nullableString(row.sprint_start_b),
			C: nullableString(row.sprint_start_c)
		},
		locked: Boolean(row.locked)
	};
}

export function deriveCategoryEventStatus(
	event: EventSnapshot,
	category: Category,
	nowMs: number
): CategoryEventStatus {
	const phase = event.phases[category];
	if (phase === 'finalised') {
		return {
			phase,
			mode: 'finalised',
			title: 'Finalised',
			timerLabel: 'Scoring closed',
			remainingMs: null,
			tone: 'success'
		};
	}

	const startValue = event.sprintStarts[category];
	const startMs = startValue ? Date.parse(startValue) : Number.NaN;
	const hasLiveClock = Number.isFinite(nowMs) && Number.isFinite(startMs);
	if (hasLiveClock) {
		if (nowMs < startMs) {
			return {
				phase,
				mode: 'scheduled',
				title: phase === 'section_b' ? 'Section B open' : 'Sprint scheduled',
				timerLabel: 'Starts in',
				remainingMs: startMs - nowMs,
				tone: phase === 'section_b' ? 'info' : 'neutral'
			};
		}

		if (phase !== 'section_b') {
			return {
				phase,
				mode: 'waiting',
				title: 'Start time reached',
				timerLabel: 'Awaiting admin',
				remainingMs: null,
				tone: 'warning'
			};
		}

		const endMs = startMs + event.sprintMinutes * 60_000;
		if (nowMs < endMs) {
			return {
				phase,
				mode: 'running',
				title: 'Sprint live',
				timerLabel: 'Remaining',
				remainingMs: endMs - nowMs,
				tone: 'danger'
			};
		}

		return {
			phase,
			mode: 'elapsed',
			title: 'Sprint elapsed',
			timerLabel: 'Time ended',
			remainingMs: 0,
			tone: 'warning'
		};
	}

	if (phase === 'section_a') {
		return {
			phase,
			mode: 'phase',
			title: 'Section A open',
			timerLabel: 'Pre-event scoring',
			remainingMs: null,
			tone: 'info'
		};
	}
	if (phase === 'section_b') {
		return {
			phase,
			mode: 'phase',
			title: 'Section B open',
			timerLabel: startValue ? 'Timer loading' : 'Timer not set',
			remainingMs: null,
			tone: 'warning'
		};
	}
	return {
		phase,
		mode: 'phase',
		title: 'Setup',
		timerLabel: startValue ? 'Timer loading' : 'Waiting to open',
		remainingMs: null,
		tone: 'neutral'
	};
}

export function formatEventDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toMalaysiaDateTimeInput(iso: string | null): string {
	if (!iso) return '';
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return '';
	return new Date(ms + MALAYSIA_OFFSET_MS).toISOString().slice(0, 16);
}

export function parseMalaysiaDateTimeInput(value: string): {
	iso: string | null;
	error: string | null;
} {
	if (!value) return { iso: null, error: null };
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
		return { iso: null, error: 'Enter a valid date and time.' };
	}
	const parsed = new Date(`${value}:00+08:00`);
	if (
		!Number.isFinite(parsed.getTime()) ||
		toMalaysiaDateTimeInput(parsed.toISOString()) !== value
	) {
		return { iso: null, error: 'Enter a valid Malaysia date and time.' };
	}
	return { iso: parsed.toISOString(), error: null };
}
