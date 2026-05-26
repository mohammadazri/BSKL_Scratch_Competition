// Drizzle schema mirror of the Postgres tables defined in SCHEMA.md.
// Owned by Track 1 (track/1-db). Edit alongside SCHEMA.md whenever the DB
// schema changes — they MUST stay in sync (see DEVELOPMENT.md § schema
// versioning).
//
// Inferred row types are re-exported from $lib/types.ts via InferSelectModel.

import { sql } from 'drizzle-orm';
import {
	bigserial,
	boolean,
	check,
	date,
	index,
	inet,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', [
	'super_admin',
	'judge',
	'viewer',
	'registration_committee'
]);
export const eventPhaseEnum = pgEnum('event_phase', [
	'setup',
	'section_a',
	'section_b',
	'finalised'
]);
export const categoryEnum = pgEnum('category', ['A', 'B', 'C']);
export const sectionEnum = pgEnum('section', ['A', 'B']);
export const perfLevelEnum = pgEnum('perf_level', [
	'Excellent',
	'Proficient',
	'Developing',
	'Insufficient'
]);
export const themeEnum = pgEnum('theme', ['Eco-Warriors', 'Smart Cities', 'Space Pioneers']);
export const scoresheetStatusEnum = pgEnum('scoresheet_status', [
	'draft',
	'submitted',
	'finalised'
]);
export const dqReasonEnum = pgEnum('dq_reason', [
	'complete_on_arrival',
	'tutorial_or_ai_use',
	'parental_assistance',
	'unsportsmanlike_conduct',
	'other'
]);
// audit_action enum + audit_log table removed in migration 013 — audit data
// now lives in a JSONL file on the Pi (see src/lib/server/audit-local.ts).

export const editRequestStatusEnum = pgEnum('edit_request_status', [
	'pending',
	'approved',
	'denied'
]);
export const disqualificationStatusEnum = pgEnum('disqualification_status', [
	'pending',
	'approved',
	'denied',
	'cleared'
]);

// ─────────────────────────────────────────────────────────────────────────────
// profiles
// (id references auth.users(id); we don't model the auth schema here.)
// ─────────────────────────────────────────────────────────────────────────────
export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey(),
	email: text('email').notNull().unique(),
	fullName: text('full_name').notNull(),
	role: userRoleEnum('role').notNull().default('judge'),
	categories: categoryEnum('categories')
		.array()
		.notNull()
		.default(sql`ARRAY['A','B','C']::category[]`),
	isActive: boolean('is_active').notNull().default(true),
	pinLabel: text('pin_label'),
	mustChangePassword: boolean('must_change_password').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// schools
// ─────────────────────────────────────────────────────────────────────────────
export const schools = pgTable('schools', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	shortCode: text('short_code'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// participants
// ─────────────────────────────────────────────────────────────────────────────
export const participants = pgTable(
	'participants',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		schoolId: uuid('school_id')
			.notNull()
			.references(() => schools.id, { onDelete: 'restrict' }),
		fullName: text('full_name').notNull(),
		category: categoryEnum('category').notNull(),
		theme: themeEnum('theme').notNull(),
		qualified: boolean('qualified').notNull().default(true),
		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		categoryIdx: index('participants_category_idx').on(t.category),
		schoolIdx: index('participants_school_idx').on(t.schoolId)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// criteria (reference data, seeded once)
// ─────────────────────────────────────────────────────────────────────────────
export const criteria = pgTable(
	'criteria',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		category: categoryEnum('category').notNull(),
		section: sectionEnum('section').notNull(),
		name: text('name').notNull(),
		maxPoints: integer('max_points').notNull(),
		sortOrder: integer('sort_order').notNull()
	},
	(t) => ({
		uniqOrder: uniqueIndex('criteria_category_section_sort_order_key').on(
			t.category,
			t.section,
			t.sortOrder
		),
		maxPointsCheck: check('criteria_max_points_check', sql`${t.maxPoints} > 0`)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// criterion_levels (reference data, seeded once)
// ─────────────────────────────────────────────────────────────────────────────
export const criterionLevels = pgTable(
	'criterion_levels',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		criterionId: uuid('criterion_id')
			.notNull()
			.references(() => criteria.id, { onDelete: 'cascade' }),
		level: perfLevelEnum('level').notNull(),
		minPts: integer('min_pts').notNull(),
		maxPts: integer('max_pts').notNull(),
		descriptor: text('descriptor').notNull()
	},
	(t) => ({
		uniqLevel: uniqueIndex('criterion_levels_criterion_id_level_key').on(t.criterionId, t.level),
		minCheck: check('criterion_levels_min_check', sql`${t.minPts} >= 0`),
		bandCheck: check('criterion_levels_band_check', sql`${t.maxPts} >= ${t.minPts}`)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// assignments
// ─────────────────────────────────────────────────────────────────────────────
export const assignments = pgTable(
	'assignments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		participantId: uuid('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		judgeId: uuid('judge_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'restrict' }),
		section: sectionEnum('section').notNull().default('B'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		judgeIdx: index('assignments_judge_idx').on(t.judgeId),
		uniqParticipantSection: uniqueIndex('assignments_participant_section_key').on(
			t.participantId,
			t.section
		)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// scoresheets
// ─────────────────────────────────────────────────────────────────────────────
export const scoresheets = pgTable(
	'scoresheets',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		participantId: uuid('participant_id')
			.notNull()
			.references(() => participants.id, { onDelete: 'cascade' }),
		judgeId: uuid('judge_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'restrict' }),
		status: scoresheetStatusEnum('status').notNull().default('draft'),
		themeSelected: themeEnum('theme_selected'),
		liveSprintTimeSeconds: integer('live_sprint_time_seconds'),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		sectionASubmittedAt: timestamp('section_a_submitted_at', { withTimezone: true }),
		submittedAt: timestamp('submitted_at', { withTimezone: true }),
		finalisedAt: timestamp('finalised_at', { withTimezone: true }),
		judgeNotes: text('judge_notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		uniqParticipantJudge: uniqueIndex('scoresheets_participant_id_judge_id_key').on(
			t.participantId,
			t.judgeId
		),
		judgeStatusIdx: index('scoresheets_judge_status_idx').on(t.judgeId, t.status),
		participantIdx: index('scoresheets_participant_idx').on(t.participantId),
		sprintTimeCheck: check(
			'scoresheets_live_sprint_time_seconds_check',
			sql`${t.liveSprintTimeSeconds} BETWEEN 0 AND 2700`
		)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// scores (one row per criterion per scoresheet)
// ─────────────────────────────────────────────────────────────────────────────
export const scores = pgTable(
	'scores',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		scoresheetId: uuid('scoresheet_id')
			.notNull()
			.references(() => scoresheets.id, { onDelete: 'cascade' }),
		criterionId: uuid('criterion_id')
			.notNull()
			.references(() => criteria.id, { onDelete: 'restrict' }),
		level: perfLevelEnum('level').notNull(),
		points: integer('points').notNull(),
		comment: text('comment'),
		isOverride: boolean('is_override').notNull().default(false),
		overrideReason: text('override_reason'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		uniqSheetCriterion: uniqueIndex('scores_scoresheet_id_criterion_id_key').on(
			t.scoresheetId,
			t.criterionId
		),
		pointsCheck: check('scores_points_check', sql`${t.points} >= 0`)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// disqualifications
// ─────────────────────────────────────────────────────────────────────────────
export const disqualifications = pgTable('disqualifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	scoresheetId: uuid('scoresheet_id')
		.notNull()
		.references(() => scoresheets.id, { onDelete: 'cascade' }),
	reason: dqReasonEnum('reason').notNull(),
	notes: text('notes').notNull(),
	raisedBy: uuid('raised_by')
		.notNull()
		.references(() => profiles.id),
	clearedBy: uuid('cleared_by').references(() => profiles.id),
	clearedReason: text('cleared_reason'),
	status: disqualificationStatusEnum('status').notNull().default('pending'),
	approvedBy: uuid('approved_by').references(() => profiles.id),
	approvedAt: timestamp('approved_at', { withTimezone: true }),
	deniedBy: uuid('denied_by').references(() => profiles.id),
	deniedAt: timestamp('denied_at', { withTimezone: true }),
	resolutionNote: text('resolution_note'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ─────────────────────────────────────────────────────────────────────────────
// edit_requests
// Judges can request edit access on a locked scoresheet; super_admin approves.
// ─────────────────────────────────────────────────────────────────────────────
export const editRequests = pgTable(
	'edit_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		scoresheetId: uuid('scoresheet_id')
			.notNull()
			.references(() => scoresheets.id, { onDelete: 'cascade' }),
		requestedBy: uuid('requested_by')
			.notNull()
			.references(() => profiles.id, { onDelete: 'cascade' }),
		reason: text('reason').notNull(),
		status: editRequestStatusEnum('status').notNull().default('pending'),
		resolvedBy: uuid('resolved_by').references(() => profiles.id),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		resolvedNote: text('resolved_note'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		scoresheetIdx: index('edit_requests_scoresheet_idx').on(t.scoresheetId),
		statusIdx: index('edit_requests_status_idx').on(t.status),
		requestedByIdx: index('edit_requests_requested_by_idx').on(t.requestedBy)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// event_state (singleton row, id = 1)
// ─────────────────────────────────────────────────────────────────────────────
export const eventState = pgTable(
	'event_state',
	{
		id: integer('id').primaryKey(),
		eventName: text('event_name').notNull().default('P3 Future Coders Challenge 2026'),
		eventDate: date('event_date'),
		sprintMinutes: integer('sprint_minutes').notNull().default(45),
		locked: boolean('locked').notNull().default(false),
		lockedAt: timestamp('locked_at', { withTimezone: true }),
		lockedBy: uuid('locked_by').references(() => profiles.id),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => ({
		singletonCheck: check('event_state_singleton', sql`${t.id} = 1`)
	})
);

// ─────────────────────────────────────────────────────────────────────────────
// audit_log (APPEND-ONLY)
// ─────────────────────────────────────────────────────────────────────────────
export const auditLog = pgTable(
	'audit_log',
	{
		id: bigserial('id', { mode: 'bigint' }).primaryKey(),
		at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
		actorId: uuid('actor_id').references(() => profiles.id),
		actorRole: userRoleEnum('actor_role'),
		actorIp: inet('actor_ip'),
		actorUa: text('actor_ua'),
		action: auditActionEnum('action').notNull(),
		targetType: text('target_type'),
		targetId: uuid('target_id'),
		beforeJson: jsonb('before_json'),
		afterJson: jsonb('after_json'),
		reason: text('reason')
	},
	(t) => ({
		atIdx: index('audit_log_at_idx').on(t.at.desc()),
		actorIdx: index('audit_log_actor_idx').on(t.actorId, t.at.desc()),
		targetIdx: index('audit_log_target_idx').on(t.targetType, t.targetId),
		actionIdx: index('audit_log_action_idx').on(t.action, t.at.desc())
	})
);
