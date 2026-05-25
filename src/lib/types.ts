// Shared TypeScript types for the P3 Judging app.
//
// Two layers live here:
//
//   1. Hand-written union aliases (Role, Category, …) that mirror the
//      Postgres ENUMs. Useful in component props and form validation where
//      we don't want to import the full Drizzle schema.
//
//   2. `InferSelectModel`-derived row types for every DB table, sourced
//      from $lib/server/db/schema.ts (Drizzle is the single source of truth
//      for row shapes — never duplicate field lists by hand).
//
// Both layers stay in sync with SCHEMA.md.

import type { InferSelectModel } from 'drizzle-orm';
import type {
	profiles,
	schools,
	participants,
	criteria,
	criterionLevels,
	assignments,
	scoresheets,
	scores,
	disqualifications,
	eventState,
	auditLog
} from './server/db/schema';

// ─── Enum aliases (mirror of Postgres types) ─────────────────────────────────
export type Role = 'super_admin' | 'judge' | 'viewer';
export type Category = 'A' | 'B' | 'C';
export type Section = 'A' | 'B';
export type PerfLevel = 'Excellent' | 'Proficient' | 'Developing' | 'Insufficient';
export type Theme = 'Eco-Warriors' | 'Smart Cities' | 'Space Pioneers';
export type ScoresheetStatus = 'draft' | 'submitted' | 'finalised';
export type DqReason =
	| 'complete_on_arrival'
	| 'tutorial_or_ai_use'
	| 'parental_assistance'
	| 'unsportsmanlike_conduct'
	| 'other';

// ─── DB row types (inferred from Drizzle schema) ─────────────────────────────
export type Profile = InferSelectModel<typeof profiles>;
export type School = InferSelectModel<typeof schools>;
export type Participant = InferSelectModel<typeof participants>;
export type Criterion = InferSelectModel<typeof criteria>;
export type CriterionLevel = InferSelectModel<typeof criterionLevels>;
export type Assignment = InferSelectModel<typeof assignments>;
export type Scoresheet = InferSelectModel<typeof scoresheets>;
export type Score = InferSelectModel<typeof scores>;
export type Disqualification = InferSelectModel<typeof disqualifications>;
export type EventState = InferSelectModel<typeof eventState>;
export type AuditLog = InferSelectModel<typeof auditLog>;
