// /admin — super-admin dashboard data loader.

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
	name: string;
	assigned: number;
	submitted: number;
};

export type ActivityRow = {
	id: number;
	at: string;
	actorName: string;
	actorRole: Role | null;
	action: string;
	targetType: string | null;
	targetId: string | null;
};

export const load: PageServerLoad = async ({ parent }) => {
	const { session } = await parent();

	// Per-category counts
	const { data: participants } = await supabaseAdmin
		.from('participants')
		.select('id, category')
		.eq('qualified', true);

	const totalByCat = new Map<Category, number>();
	for (const p of participants ?? []) {
		const c = p.category as Category;
		totalByCat.set(c, (totalByCat.get(c) ?? 0) + 1);
	}

	const { data: sheets } = await supabaseAdmin
		.from('scoresheets')
		.select('participant_id, judge_id, status')
		.in('status', ['submitted', 'finalised']);

	const scoredParticipantByCat = new Map<Category, Set<string>>();
	const submittedByJudge = new Map<string, number>();
	for (const s of sheets ?? []) {
		const part = (participants ?? []).find((p) => p.id === s.participant_id);
		if (part) {
			const c = part.category as Category;
			let set = scoredParticipantByCat.get(c);
			if (!set) {
				set = new Set();
				scoredParticipantByCat.set(c, set);
			}
			set.add(s.participant_id as string);
		}
		submittedByJudge.set(
			s.judge_id as string,
			(submittedByJudge.get(s.judge_id as string) ?? 0) + 1
		);
	}

	const categoryProgress: CategoryProgress[] = (['A', 'B', 'C'] as Category[]).map((c) => ({
		category: c,
		total: totalByCat.get(c) ?? 0,
		scored: scoredParticipantByCat.get(c)?.size ?? 0
	}));

	// Judge load
	const { data: judges } = await supabaseAdmin
		.from('profiles')
		.select('id, full_name, role')
		.in('role', ['judge', 'super_admin'])
		.eq('is_active', true)
		.order('full_name');

	const { data: assigns } = await supabaseAdmin.from('assignments').select('judge_id');
	const assignedByJudge = new Map<string, number>();
	for (const a of assigns ?? []) {
		assignedByJudge.set(a.judge_id as string, (assignedByJudge.get(a.judge_id as string) ?? 0) + 1);
	}

	const judgeLoads: JudgeLoad[] = (judges ?? [])
		.map((j) => ({
			id: j.id as string,
			name: j.full_name as string,
			assigned: assignedByJudge.get(j.id as string) ?? 0,
			submitted: submittedByJudge.get(j.id as string) ?? 0
		}))
		.filter((j) => j.assigned > 0 || j.id === session.user.id)
		.sort((a, b) => b.assigned - a.assigned);

	// Recent activity (last 20)
	const { data: audit } = await supabaseAdmin
		.from('audit_log')
		.select('id, at, actor_id, actor_role, action, target_type, target_id')
		.order('at', { ascending: false })
		.limit(20);

	const actorIds = [...new Set((audit ?? []).map((a) => a.actor_id as string).filter(Boolean))];
	const { data: actors } = actorIds.length
		? await supabaseAdmin.from('profiles').select('id, full_name').in('id', actorIds)
		: { data: [] };
	const nameById = new Map<string, string>();
	for (const a of actors ?? []) nameById.set(a.id as string, a.full_name as string);

	const activity: ActivityRow[] = (audit ?? []).map((a) => ({
		id: Number(a.id),
		at: a.at as string,
		actorName: a.actor_id ? (nameById.get(a.actor_id as string) ?? 'Unknown') : 'System',
		actorRole: (a.actor_role as Role | null) ?? null,
		action: a.action as string,
		targetType: (a.target_type as string | null) ?? null,
		targetId: (a.target_id as string | null) ?? null
	}));

	// Event meta
	const { data: ev } = await supabaseAdmin
		.from('event_state')
		.select('event_name, event_date, locked')
		.eq('id', 1)
		.single();

	return {
		categoryProgress,
		judgeLoads,
		activity,
		event: {
			name: (ev?.event_name as string) ?? 'P3 Future Coders Challenge 2026',
			date: (ev?.event_date as string | null) ?? null,
			locked: (ev?.locked as boolean) ?? false
		}
	};
};
