<!--
	UserAvatar — initials in a coloured circle (DESIGN.md § 3 top bar).
-->
<script lang="ts">
	interface Props {
		name: string;
		size?: number;
	}

	let { name, size = 32 }: Props = $props();

	const initials = $derived(
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);

	// Deterministic colour from name — picks one of two brand tones.
	const tone = $derived(
		[...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 2 === 0 ? 'accent' : 'accent-2'
	);
</script>

<span
	class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
	style="width: {size}px; height: {size}px; font-size: {Math.round(
		size * 0.4
	)}px; background: {tone === 'accent'
		? 'var(--accent-soft)'
		: 'rgba(56, 189, 248, 0.14)'}; color: {tone === 'accent'
		? 'var(--color-accent)'
		: 'var(--color-accent-2)'};"
	aria-hidden="true"
>
	{initials}
</span>
