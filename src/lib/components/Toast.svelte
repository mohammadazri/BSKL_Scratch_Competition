<!--
	Toast — global toast service. DESIGN.md § 2 motion: slide in from top-right,
	auto-dismiss 4s. Subscribed via the `toasts` store in $lib/stores/toast.ts.
-->
<script lang="ts">
	import { toasts } from '$lib/stores/toast';
	import { CheckCircle2, AlertTriangle, CircleAlert, X } from 'lucide-svelte';
</script>

<div class="pointer-events-none fixed top-4 right-4 z-[100] flex w-80 flex-col gap-2">
	{#each $toasts as t (t.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-sm shadow-lg"
			style="background: var(--color-bg-2); border-color: var(--border-strong); color: var(--color-text-1);"
			role={t.kind === 'error' ? 'alert' : 'status'}
		>
			<span
				class="mt-0.5"
				style="color: {t.kind === 'success'
					? 'var(--color-success)'
					: t.kind === 'error'
						? 'var(--color-danger)'
						: 'var(--color-warning)'};"
			>
				{#if t.kind === 'success'}
					<CheckCircle2 size={16} strokeWidth={1.5} />
				{:else if t.kind === 'error'}
					<CircleAlert size={16} strokeWidth={1.5} />
				{:else}
					<AlertTriangle size={16} strokeWidth={1.5} />
				{/if}
			</span>
			<div class="min-w-0 flex-1">
				{#if t.title}
					<p class="text-sm font-semibold">{t.title}</p>
				{/if}
				<p class="text-xs" style="color: var(--color-text-2);">{t.message}</p>
			</div>
			<button
				type="button"
				class="rounded-[var(--radius-sm)] p-1 hover:bg-white/5"
				style="color: var(--color-text-3);"
				onclick={() => toasts.dismiss(t.id)}
				aria-label="Dismiss"
			>
				<X size={14} strokeWidth={1.5} />
			</button>
		</div>
	{/each}
</div>
