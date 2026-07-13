// Mirror of the Postgres `audit_action` enum (SCHEMA.md).
// Kept as a plain TS union for use in component props and filter UI.

export type AuditAction =
	| 'login'
	| 'logout'
	| 'user_create'
	| 'user_update'
	| 'user_role_change'
	| 'user_disable'
	| 'user_delete'
	| 'school_create'
	| 'school_update'
	| 'school_delete'
	| 'participant_create'
	| 'participant_update'
	| 'participant_delete'
	| 'participant_import'
	| 'assignment_create'
	| 'assignment_update'
	| 'assignment_delete'
	| 'assignment_auto_run'
	| 'scoresheet_create'
	| 'scoresheet_update'
	| 'scoresheet_submit'
	| 'scoresheet_unlock'
	| 'scoresheet_delete'
	| 'score_create'
	| 'score_update'
	| 'score_override'
	| 'score_delete'
	| 'dq_flag_raise'
	| 'dq_flag_clear'
	| 'event_lock'
	| 'event_unlock'
	| 'event_phase_change'
	| 'event_timer_change'
	| 'export_csv'
	| 'export_pdf';

export const ALL_AUDIT_ACTIONS: AuditAction[] = [
	'login',
	'logout',
	'user_create',
	'user_update',
	'user_role_change',
	'user_disable',
	'user_delete',
	'school_create',
	'school_update',
	'school_delete',
	'participant_create',
	'participant_update',
	'participant_delete',
	'participant_import',
	'assignment_create',
	'assignment_update',
	'assignment_delete',
	'assignment_auto_run',
	'scoresheet_create',
	'scoresheet_update',
	'scoresheet_submit',
	'scoresheet_unlock',
	'scoresheet_delete',
	'score_create',
	'score_update',
	'score_override',
	'score_delete',
	'dq_flag_raise',
	'dq_flag_clear',
	'event_lock',
	'event_unlock',
	'event_phase_change',
	'event_timer_change',
	'export_csv',
	'export_pdf'
];

export const ALL_TARGET_TYPES = [
	'user',
	'school',
	'participant',
	'assignment',
	'scoresheet',
	'score',
	'dq_flag',
	'event_state'
] as const;
export type TargetType = (typeof ALL_TARGET_TYPES)[number];

// Actions that get the override visual treatment (--accent-soft background).
// Per DESIGN.md § 4 D, override rows are visually distinct by default.
export const OVERRIDE_ACTIONS: ReadonlySet<AuditAction> = new Set([
	'score_override',
	'scoresheet_unlock',
	'user_role_change',
	'user_disable',
	'event_lock',
	'event_unlock'
]);

// Actions that signal a disqualification event — get the warning icon.
export const DQ_ACTIONS: ReadonlySet<AuditAction> = new Set(['dq_flag_raise', 'dq_flag_clear']);

// Human-readable labels for action enum values.
export function actionLabel(a: AuditAction): string {
	return a.replaceAll('_', ' ');
}

// Fields hidden from the before/after JSON diff display — they always differ
// and add noise. They stay in the underlying data; we just don't render them.
export const NOISY_JSON_FIELDS: ReadonlySet<string> = new Set(['id', 'created_at', 'updated_at']);
