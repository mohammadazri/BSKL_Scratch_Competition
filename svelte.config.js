import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Content Security Policy — configured here (not in hooks.server.ts) so
		// SvelteKit can auto-nonce its own inline bootstrap script. Setting
		// `script-src 'self'` manually without nonces breaks hydration.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'base-uri': ['self'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'object-src': ['none'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self', 'data:'],
				'style-src': ['self', 'unsafe-inline'],
				'script-src': ['self'],
				'connect-src': ['self', 'https://*.supabase.co', 'wss://*.supabase.co'],
				'manifest-src': ['self']
			}
		}
	}
};

export default config;
