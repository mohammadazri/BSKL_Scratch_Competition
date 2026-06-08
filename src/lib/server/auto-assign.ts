// Auto-assign algorithm — simple equal division.
//
// 30 students ÷ 3 judges = 10 students each. If the count doesn't divide
// evenly the remainder is spread one-per-judge across the first N judges
// (so 31/3 → 11, 10, 10 not 11, 11, 9).
//
// IMPORTANT: this used to call `shuffle()` (crypto.getRandomValues), which
// meant every preview returned a *different* bucket assignment. Admins ran
// the preview once for Section A, again before Section B, and saw a totally
// different judge → student mapping. Committing that wiped Section A work.
//
// Now we sort by participant id (UUID v4 — effectively random distribution
// but stable). Judges and participants are also sorted by id so the output
// is fully deterministic: the same inputs always produce the same buckets.
// UUID ordering is unbiased enough to avoid school/alphabet clustering in
// practice without introducing per-run randomness.

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
}

export interface AutoAssignBucket {
	judge_id: string;
	participant_ids: string[];
}

/** Pure: returns the planned buckets, does not write to the DB. */
export function autoAssign(args: AutoAssignArgs): AutoAssignBucket[] {
	const { participants, judges } = args;
	if (judges.length === 0) throw new Error('no eligible judges');

	const sortedParticipants = [...participants].sort((a, b) => a.id.localeCompare(b.id));
	const sortedJudges = [...judges].sort((a, b) => a.id.localeCompare(b.id));

	const buckets: AutoAssignBucket[] = sortedJudges.map((j) => ({
		judge_id: j.id,
		participant_ids: []
	}));

	// Round-robin against the deterministic order: participant N → judge N % J.
	for (let i = 0; i < sortedParticipants.length; i++) {
		buckets[i % sortedJudges.length].participant_ids.push(sortedParticipants[i].id);
	}

	return buckets;
}
