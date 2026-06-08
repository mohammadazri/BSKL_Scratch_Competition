<!--
	StatusPill — small badge for scoresheet / participant status.
	Per DESIGN.md § 3 status pills: coloured dot + text on bg-3 surface.
-->
<script lang="ts">
	// `section_a_done` is a derived UX status: scoresheets.status is still
	// 'draft' (the row is one record across both sections), but the judge has
	// already stamped section_a_submitted_at. From the judge's point of view
	// Section A is "Done", and showing them "draft" feels like nothing was
	// saved — so we surface the intent.
	type Status =
		| 'not_started'
		| 'draft'
		| 'section_a_done'
		| 'submitted'
		| 'finalised'
		| 'override'
		| 'dq';

	interface Props {
		status: Status;
		label?: string;
	}

	let { status, label }: Props = $props();

	const meta: Record<Status, { dot: string; text: string }> = {
		not_started: { dot: 'var(--color-text-3)', text: 'not started' },
		draft: { dot: 'var(--color-warning)', text: 'draft' },
		section_a_done: { dot: 'var(--color-accent)', text: 'Section A done' },
		submitted: { dot: 'var(--color-success)', text: 'completed' },
		finalised: { dot: 'var(--color-success)', text: 'completed' },
		override: { dot: 'var(--color-danger)', text: 'override' },
		dq: { dot: 'var(--color-danger)', text: 'disqualified' }
	};

	let m = $derived(meta[status]);
</script>

<span
	class="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
	style="background: var(--color-bg-3); color: var(--color-text-1);"
>
	<span
		class="inline-block h-2 w-2 rounded-full"
		style="background: {m.dot};"
		aria-hidden="true"
	></span>
	<span>{label ?? m.text}</span>
</span>
