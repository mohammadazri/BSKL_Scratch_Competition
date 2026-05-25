// Shared types for the results / leaderboard track (Track 5).
//
// The DB does the heavy lifting via the `final_rankings` view (see SCHEMA.md).
// We never re-rank or re-sort on the client — rows arrive ordered + ranked.
//
// These are the row shapes the loader returns; the UI consumes them as-is.

import type { Category, Theme, ScoresheetStatus } from '$lib/types';

/** One row from `final_rankings` joined with display columns and a status. */
export type RankingRow = {
	participantId: string;
	participantName: string;
	schoolName: string;
	category: Category;
	theme: Theme | null;
	qualified: boolean;
	totalPoints: number | null;
	liveSprintTimeSeconds: number | null;
	submittedAt: string | null; // ISO
	judgeId: string | null;
	judgeName: string | null;
	judgeEmail: string | null;
	rank: number | null; // null when no submitted scoresheet exists
	scoresheetId: string | null;
	scoresheetStatus: ScoresheetStatus | 'not_started';
	hasOverride: boolean;
	isTied: boolean;
};

/** Active filter set parsed from the URL. */
export type ResultsFilters = {
	categories: Category[]; // empty = all
	themes: (Theme | 'none')[]; // empty = all; 'none' matches null theme
	schools: string[]; // school ids; empty = all
	statuses: (ScoresheetStatus | 'not_started')[]; // empty = all
};

/** Data exposed to the leaderboard page. */
export type ResultsPageData = {
	rows: RankingRow[];
	filters: ResultsFilters;
	schoolOptions: { id: string; name: string }[];
	totals: {
		scored: number;
		pending: number;
		tiesBrokenByTime: number;
	};
	role: 'super_admin' | 'viewer';
	loadError: string | null;
};

/** Data for the single-scoresheet drill-in page. */
export type ScoresheetDetail = {
	scoresheetId: string;
	participantId: string;
	participantName: string;
	schoolName: string;
	category: Category;
	theme: Theme | null;
	judgeId: string;
	judgeName: string;
	judgeEmail: string;
	status: ScoresheetStatus;
	liveSprintTimeSeconds: number | null;
	submittedAt: string | null;
	totalPoints: number;
	maxPoints: number;
	sections: SectionGroup[];
};

export type SectionGroup = {
	section: 'A' | 'B';
	label: string;
	scores: ScoreLineItem[];
	subtotal: number;
	maxSubtotal: number;
};

export type ScoreLineItem = {
	scoreId: string | null; // null if not yet scored
	criterionId: string;
	criterionName: string;
	sortOrder: number;
	maxPoints: number;
	level: import('$lib/types').PerfLevel | null;
	points: number | null;
	comment: string | null;
	isOverride: boolean;
	overrideReason: string | null;
	levelBands: import('$lib/scoring').RubricLevel[];
};

export type ScoresheetPageData = {
	detail: ScoresheetDetail | null;
	role: 'super_admin' | 'viewer';
	loadError: string | null;
};
