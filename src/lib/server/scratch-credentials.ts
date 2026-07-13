import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Theme } from '$lib/types';

export type ScratchCredentials = {
	username: string;
	password: string;
};

export type ScratchCredentialInput = {
	username: string;
	password: string | null;
};

export type ScratchCredentialSummary = {
	participantId: string;
	username: string;
};

const MAX_USERNAME_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 200;

export async function fetchScratchCredentialSummaries(
	supabase: SupabaseClient,
	participantIds: string[]
): Promise<{ rows: ScratchCredentialSummary[]; error: string | null }> {
	if (participantIds.length === 0) return { rows: [], error: null };
	const { data, error } = await supabase
		.from('participant_scratch_credentials')
		.select('participant_id, username')
		.in('participant_id', participantIds);
	return {
		rows: (data ?? []).map((row) => ({
			participantId: row.participant_id as string,
			username: row.username as string
		})),
		error: error?.message ?? null
	};
}

export function parseScratchCredentials(
	usernameValue: FormDataEntryValue | null | unknown,
	passwordValue: FormDataEntryValue | null | unknown,
	options: { passwordRequired?: boolean } = {}
): { credentials: ScratchCredentialInput | null; error: string | null } {
	const username = typeof usernameValue === 'string' ? usernameValue.trim() : '';
	const rawPassword = typeof passwordValue === 'string' ? passwordValue : '';
	const password = rawPassword.trim() ? rawPassword : null;
	const passwordRequired = options.passwordRequired ?? true;

	if (!username || (passwordRequired && !password)) {
		return { credentials: null, error: 'Scratch username and password are required.' };
	}
	if (username.length > MAX_USERNAME_LENGTH) {
		return {
			credentials: null,
			error: `Scratch username is too long (maximum ${MAX_USERNAME_LENGTH} characters).`
		};
	}
	if (!/^[A-Za-z0-9_-]+$/.test(username)) {
		return {
			credentials: null,
			error: 'Scratch username can only contain letters, numbers, underscores and hyphens.'
		};
	}
	if (password && password.length > MAX_PASSWORD_LENGTH) {
		return {
			credentials: null,
			error: `Scratch password is too long (maximum ${MAX_PASSWORD_LENGTH} characters).`
		};
	}

	return { credentials: { username, password }, error: null };
}

export async function createParticipantWithScratch(
	supabase: SupabaseClient,
	participant: {
		fullName: string;
		schoolId: string;
		category: Category;
		theme: Theme;
	},
	credentials: ScratchCredentialInput,
	updatedBy: string
): Promise<{ id: string | null; error: string | null }> {
	if (!credentials.password) {
		return { id: null, error: 'Scratch password is required.' };
	}
	const { data, error } = await supabase.rpc('create_participant_with_scratch', {
		p_full_name: participant.fullName,
		p_school_id: participant.schoolId,
		p_category: participant.category,
		p_theme: participant.theme,
		p_username: credentials.username,
		p_password: credentials.password,
		p_updated_by: updatedBy
	});
	return { id: (data as string | null) ?? null, error: error?.message ?? null };
}

export async function updateParticipantWithScratch(
	supabase: SupabaseClient,
	participantId: string,
	participant: {
		fullName: string;
		schoolId: string;
		category: Category;
		theme: Theme;
	},
	credentials: ScratchCredentialInput,
	updatedBy: string
): Promise<string | null> {
	const { error } = await supabase.rpc('update_participant_with_scratch', {
		p_participant_id: participantId,
		p_full_name: participant.fullName,
		p_school_id: participant.schoolId,
		p_category: participant.category,
		p_theme: participant.theme,
		p_username: credentials.username,
		p_password: credentials.password,
		p_updated_by: updatedBy
	});
	return error?.message ?? null;
}

export async function importParticipantsWithScratch(
	supabase: SupabaseClient,
	rows: Record<string, string>[],
	updatedBy: string
): Promise<{ created: number; error: string | null }> {
	const { data, error } = await supabase.rpc('import_participants_with_scratch', {
		p_rows: rows,
		p_updated_by: updatedBy
	});
	return { created: Number(data ?? 0), error: error?.message ?? null };
}
