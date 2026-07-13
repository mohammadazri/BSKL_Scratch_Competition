import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { EVENT_CATEGORIES } from '$lib/event-status';
import type { Category } from '$lib/types';

export type RegistrationCategoryMetrics = {
	registered: number;
	qualified: number;
	credentialsReady: number;
	assignedA: number;
	assignedB: number;
	submittedA: number;
	submittedB: number;
};

function emptyMetrics(): RegistrationCategoryMetrics {
	return {
		registered: 0,
		qualified: 0,
		credentialsReady: 0,
		assignedA: 0,
		assignedB: 0,
		submittedA: 0,
		submittedB: 0
	};
}

export const load: PageServerLoad = async ({ parent }) => {
	await parent();

	const [schoolsResult, participantsResult, credentialsResult, assignmentsResult, sheetsResult] =
		await Promise.all([
			supabaseAdmin.from('schools').select('id', { count: 'exact', head: true }),
			supabaseAdmin.from('participants').select('id, category, qualified'),
			supabaseAdmin.from('participant_scratch_credentials').select('participant_id'),
			supabaseAdmin.from('assignments').select('participant_id, section'),
			supabaseAdmin
				.from('scoresheets')
				.select('participant_id, section, status')
				.in('status', ['submitted', 'finalised'])
		]);

	const firstError = [
		schoolsResult.error,
		participantsResult.error,
		credentialsResult.error,
		assignmentsResult.error,
		sheetsResult.error
	].find(Boolean);
	if (firstError) throw error(500, firstError.message);

	const categories: Record<Category, RegistrationCategoryMetrics> = {
		A: emptyMetrics(),
		B: emptyMetrics(),
		C: emptyMetrics()
	};
	const participantCategory = new Map<string, Category>();
	const qualifiedIds = new Set<string>();
	for (const participant of participantsResult.data ?? []) {
		const id = participant.id as string;
		const category = participant.category as Category;
		participantCategory.set(id, category);
		categories[category].registered += 1;
		if (participant.qualified) {
			categories[category].qualified += 1;
			qualifiedIds.add(id);
		}
	}

	const credentialIds = new Set(
		(credentialsResult.data ?? []).map((row) => row.participant_id as string)
	);
	for (const participantId of credentialIds) {
		const category = participantCategory.get(participantId);
		if (category) categories[category].credentialsReady += 1;
	}

	const assignmentKeys = new Set<string>();
	for (const assignment of assignmentsResult.data ?? []) {
		const participantId = assignment.participant_id as string;
		if (!qualifiedIds.has(participantId)) continue;
		const section = assignment.section as 'A' | 'B';
		const key = `${participantId}:${section}`;
		if (assignmentKeys.has(key)) continue;
		assignmentKeys.add(key);
		const category = participantCategory.get(participantId);
		if (category) categories[category][section === 'A' ? 'assignedA' : 'assignedB'] += 1;
	}

	const submittedKeys = new Set<string>();
	for (const sheet of sheetsResult.data ?? []) {
		const participantId = sheet.participant_id as string;
		if (!qualifiedIds.has(participantId)) continue;
		const section = sheet.section as 'A' | 'B';
		const key = `${participantId}:${section}`;
		if (submittedKeys.has(key)) continue;
		submittedKeys.add(key);
		const category = participantCategory.get(participantId);
		if (category) categories[category][section === 'A' ? 'submittedA' : 'submittedB'] += 1;
	}

	const totals = EVENT_CATEGORIES.reduce(
		(acc, category) => {
			const item = categories[category];
			acc.registered += item.registered;
			acc.qualified += item.qualified;
			acc.credentialsReady += item.credentialsReady;
			return acc;
		},
		{ registered: 0, qualified: 0, credentialsReady: 0 }
	);

	return {
		schoolCount: schoolsResult.count ?? 0,
		totals,
		categories,
		refreshedAt: new Date().toISOString()
	};
};
