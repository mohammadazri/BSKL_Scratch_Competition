// Auto-assign algorithm — simple equal division.
//
// 30 students ÷ 3 judges = 10 students each. If the count doesn't divide
// evenly the remainder is spread one-per-judge across the first N judges
// (so 31/3 → 11, 10, 10 not 11, 11, 9).
//
// We still shuffle the participant order before slicing so the assignment
// isn't biased by registration order (alphabetical, by school, etc).
// `shuffle` is backed by crypto.getRandomValues so it's non-predictable.

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
}

export interface AutoAssignBucket {
	judge_id: string;
	participant_ids: string[];
}

/** Pure: returns the planned buckets, does not write to the DB. */
export function autoAssign(args: AutoAssignArgs): AutoAssignBucket[] {
	const { participants, judges } = args;
	if (judges.length === 0) throw new Error('no eligible judges');

	const order = shuffle(participants);
	const buckets: AutoAssignBucket[] = judges.map((j) => ({
		judge_id: j.id,
		participant_ids: []
	}));

	// Round-robin: participant N goes to judge N % judges.length. With the
	// shuffled order above, this produces an even split (within one of each
	// other when the count doesn't divide evenly) with no school bias.
	for (let i = 0; i < order.length; i++) {
		buckets[i % judges.length].participant_ids.push(order[i].id);
	}

	return buckets;
}
