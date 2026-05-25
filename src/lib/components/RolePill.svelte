<!--
	RolePill — DESIGN.md: super_admin → magenta, judge → cyan, viewer → text-2.
-->
<script lang="ts">
	import type { Role } from '$lib/types';

	interface Props {
		role: Role;
	}

	let { role }: Props = $props();

	const config = $derived(
		role === 'super_admin'
			? { label: 'Super admin', bg: 'var(--accent-soft)', fg: 'var(--color-accent)' }
			: role === 'judge'
				? { label: 'Judge', bg: 'rgba(56, 189, 248, 0.14)', fg: 'var(--color-accent-2)' }
				: { label: 'Viewer', bg: 'var(--color-bg-3)', fg: 'var(--color-text-2)' }
	);
</script>

<span
	class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
	style="background: {config.bg}; color: {config.fg};"
>
	{config.label}
</span>
