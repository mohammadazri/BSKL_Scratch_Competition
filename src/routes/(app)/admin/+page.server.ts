// /admin dashboard — DESIGN.md § 4 B.
// Loads:
//   1. Per-category progress (scored vs total participants)
//   2. Judge load (assigned vs scored)
//   3. Last 20 audit_log entries (initial; client subscribes to realtime for tail)
//   4. event_state for the countdown/lock badge

import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import type { Category, Role } from '$lib/types';

export type CategoryProgress = {
	category: Category;
	total: number;
	scored: number;
};

export type JudgeLoad = {
	id: string;
	fullName: string;
	assigned: number;
	scored: number;
};

export type RecentActivity = {
	id: string;
	at: string;
	actorName: string | null;
	actorRole: Role | null;
	action: string;
	targetType: string | null;
	targetId: string | null;
};

export type DashboardEvent = {
	eventName: string;
	eventDate: string | null;
	sprintMinutes: number;
	locked: boolean;
	lockedAt: string | null;
	lockedBy: string | null;
};

export const load: PageServerLoad = async () => {
	// 1. Participants per category + scored counts per category.
	const { data: parts } = await supabaseAdmin
		.from('participants')
		.select('id, category, qualified');

	const totals: Record<Category, number> = { A: 0, B: 0, C: 0 };
	for (const p of parts ?? []) {
		if (p.qualified) totals[p.category as Category]++;
	}

	const { data: rankings } = await supabaseAdmin
		.from('final_rankings')
		.select('participant_id, category, total_points, submitted_at');

	const scored: Record<Category, number> = { A: 0, B: 0, C: 0 };
	for (const r of rankings ?? []) {
		if (r.submitted_at) scored[r.category as Category]++;
	}

	const progress: CategoryProgress[] = (['A', 'B', 'C'] as Category[]).map((c) => ({
		category: c,
		total: totals[c],
		scored: scored[c]
	}));

	// 2. Judge load — assignments count + submitted/finalised count.
	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, role, is_active')
		.eq('role', 'judge')
		.eq('is_active', true)
		.order('full_name');

	const { data: assignments } = await supabaseAdmin
		.from('assignments')
		.select('judge_id');

	const { data: sheets } = await supabaseAdmin
		.from('scoresheets')
		.select('judge_id, status');

	const judgeLoad: JudgeLoad[] = (judges ?? []).map((j) => {
		const assigned = (assignments ?? []).filter((a) => a.judge_id === j.id).length;
		const done = (sheets ?? []).filter(
			(s) => s.judge_id === j.id && (s.status === 'submitted' || s.status === 'finalised')
		).length;
		return {
			id: j.id as string,
			fullName: j.full_name as string,
			assigned,
			scored: done
		};
	});

	// 3. Last 20 audit entries with actor name joined in.
	const { data: audits } = await supabaseAdmin
		.from('audit_log')
		.select('id, at, actor_id, actor_role, action, target_type, target_id')
		.order('at', { ascending: false })
		.limit(20);

	const actorIds = Array.from(
		new Set((audits ?? []).map((a) => a.actor_id).filter((v): v is string => !!v))
	);
	const actorNames = new Map<string, string>();
	if (actorIds.length > 0) {
		const { data: actors } = await supabaseAdmin
			.from('profiles')
			.select('id, full_name')
			.in('id', actorIds);
		for (const a of actors ?? []) {
			actorNames.set(a.id as string, a.full_name as string);
		}
	}

	const recent: RecentActivity[] = (audits ?? []).map((a) => ({
		id: String(a.id),
		at: a.at as string,
		actorName: a.actor_id ? (actorNames.get(a.actor_id) ?? 'Unknown') : 'System',
		actorRole: (a.actor_role as Role | null) ?? null,
		action: a.action as string,
		targetType: (a.target_type as string | null) ?? null,
		targetId: (a.target_id as string | null) ?? null
	}));

	// 4. event_state.
	const { data: ev } = await supabaseAdmin
		.from('event_state')
		.select('event_name, event_date, sprint_minutes, locked, locked_at, locked_by')
		.eq('id', 1)
		.single();

	let lockedByName: string | null = null;
	if (ev?.locked_by) {
		const { data: lb } = await supabaseAdmin
			.from('profiles')
			.select('full_name')
			.eq('id', ev.locked_by)
			.single();
		lockedByName = (lb?.full_name as string | undefined) ?? null;
	}

	const event: DashboardEvent | null = ev
		? {
				eventName: ev.event_name as string,
				eventDate: (ev.event_date as string | null) ?? null,
				sprintMinutes: ev.sprint_minutes as number,
				locked: ev.locked as boolean,
				lockedAt: (ev.locked_at as string | null) ?? null,
				lockedBy: lockedByName
			}
		: null;

	return { progress, judgeLoad, recent, event };
};
