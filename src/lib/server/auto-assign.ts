// Auto-assign algorithm — TRACK_2_ADMIN.md "Auto-assign algorithm".
// Round-robins shuffled participants across qualified judges, capping the
// number from any one school per judge (default 3). When the cap can't be
// satisfied, falls back to the least-loaded judge — school-spread is
// best-effort, not a hard guarantee.
//
// Determinism: uses `shuffle` from $lib/utils/random which is backed by
// crypto.getRandomValues, so the result is non-predictable.

import { shuffle } from '$lib/utils/random';

export interface ParticipantInput {
	id: string;
	school_id: string;
}

export interface JudgeInput {
	id: string;
}

export interface AutoAssignArgs {
	participants: ParticipantInput[];
	judges: JudgeInput[];
	/** Soft cap — number of participants from one school assigned to one judge. */
	maxPerSchoolPerJudge?: number;
}

export interface AutoAssignBucket {
	judge_id: string;
	participant_ids: string[];
}

/** Runs the round-robin auto-assignment. Pure (returns the plan, does not write to DB). */
export function autoAssign(args: AutoAssignArgs): AutoAssignBucket[] {
	const { participants, judges, maxPerSchoolPerJudge = 3 } = args;
	if (judges.length === 0) throw new Error('no eligible judges');

	const shuffled = shuffle(participants);
	const buckets = new Map<string, ParticipantInput[]>();
	judges.forEach((j) => buckets.set(j.id, []));

	let i = 0;
	outer: for (const p of shuffled) {
		// Try each judge starting from the round-robin pointer; skip any whose
		// school-cap is already hit for this participant's school.
		for (let tries = 0; tries < judges.length; tries++) {
			const judge = judges[(i + tries) % judges.length];
			const bucket = buckets.get(judge.id)!;
			const fromSameSchool = bucket.filter((x) => x.school_id === p.school_id).length;
			if (fromSameSchool < maxPerSchoolPerJudge) {
				bucket.push(p);
				i = (i + tries + 1) % judges.length;
				continue outer;
			}
		}
		// Fallback: no judge under cap → give to least-loaded.
		const least = [...buckets.entries()].sort((a, b) => a[1].length - b[1].length)[0];
		least[1].push(p);
	}

	return [...buckets.entries()].map(([judge_id, parts]) => ({
		judge_id,
		participant_ids: parts.map((p) => p.id)
	}));
}
