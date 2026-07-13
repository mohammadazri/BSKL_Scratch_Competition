import { describe, expect, it } from 'vitest';
import { parseScratchCredentials } from './scratch-credentials';

describe('parseScratchCredentials', () => {
	it('requires both values when creating a participant', () => {
		expect(parseScratchCredentials('scratch-user', '')).toEqual({
			credentials: null,
			error: 'Scratch username and password are required.'
		});
	});

	it('trims the username but preserves password characters', () => {
		expect(parseScratchCredentials('  scratch-user  ', ' pass phrase ')).toEqual({
			credentials: { username: 'scratch-user', password: ' pass phrase ' },
			error: null
		});
	});

	it('allows a blank password on edit so the stored password is retained', () => {
		expect(parseScratchCredentials('scratch-user', '', { passwordRequired: false })).toEqual({
			credentials: { username: 'scratch-user', password: null },
			error: null
		});
	});

	it('rejects whitespace-only passwords', () => {
		expect(parseScratchCredentials('scratch-user', '   ').credentials).toBeNull();
	});

	it('bounds credential lengths before a database write', () => {
		expect(parseScratchCredentials('u'.repeat(51), 'password').credentials).toBeNull();
		expect(parseScratchCredentials('scratch-user', 'p'.repeat(201)).credentials).toBeNull();
	});

	it('rejects characters Scratch does not allow in usernames', () => {
		expect(parseScratchCredentials('not a username', 'password').credentials).toBeNull();
	});
});
