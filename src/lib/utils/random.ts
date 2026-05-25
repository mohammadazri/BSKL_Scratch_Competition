// Cryptographically-secure shuffle. Uses crypto.getRandomValues so the order
// is not predictable from a seed — important for auto-assignment fairness.

export function shuffle<T>(input: readonly T[]): T[] {
	const arr = input.slice();
	const len = arr.length;
	if (len <= 1) return arr;
	const rand = new Uint32Array(len);
	crypto.getRandomValues(rand);
	for (let i = len - 1; i > 0; i--) {
		// Map a uint32 into [0, i] uniformly enough for our scale.
		const j = rand[i] % (i + 1);
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

/** Generate a printable random temporary password. */
export function tempPassword(length = 10): string {
	// Avoid ambiguous chars (0/O, 1/l/I) for paper-handout legibility.
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
	const buf = new Uint32Array(length);
	crypto.getRandomValues(buf);
	let out = '';
	for (let i = 0; i < length; i++) {
		out += alphabet[buf[i] % alphabet.length];
	}
	return out;
}
