<!--
	AssignmentMatrix — TRACK_2_ADMIN.md /admin/assignments. Compact grid:
	rows = participants, columns = judges, single dot in the assigned cell.
	Click an empty cell to assign. Click a filled cell to clear.
-->
<script lang="ts">
	interface JudgeColumn {
		id: string;
		name: string;
		load: number;
	}
	interface ParticipantRow {
		id: string;
		name: string;
		school: string;
		assignedJudgeId: string | null;
	}

	interface Props {
		judges: JudgeColumn[];
		participants: ParticipantRow[];
		onassign?: (participantId: string, judgeId: string | null) => void | Promise<void>;
		pending?: Set<string>;
	}

	let { judges, participants, onassign, pending = new Set<string>() }: Props = $props();
</script>

<div
	class="overflow-x-auto rounded-[var(--radius)] border"
	style="border-color: var(--border); background: var(--color-bg-1);"
>
	<table class="border-collapse text-sm">
		<thead>
			<tr style="background: var(--color-bg-3);">
				<th
					class="sticky left-0 z-10 px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
					style="color: var(--color-text-2); background: var(--color-bg-3); min-width: 200px;"
				>
					Participant
				</th>
				{#each judges as j (j.id)}
					<th
						class="px-2 py-2 text-center text-[11px] font-medium tracking-wider uppercase"
						style="color: var(--color-text-2); min-width: 96px;"
					>
						<span class="block">{j.name}</span>
						<span class="block text-[10px] font-normal" style="color: var(--color-text-3);">
							{j.load}
						</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each participants as p, i (p.id)}
				<tr
					class="border-t"
					style="border-color: var(--border); background: {i % 2 === 0
						? 'var(--color-bg-1)'
						: 'var(--color-bg-2)'};"
				>
					<td
						class="sticky left-0 z-10 px-3 py-2"
						style="color: var(--color-text-1); background: {i % 2 === 0
							? 'var(--color-bg-1)'
							: 'var(--color-bg-2)'};"
					>
						<span class="block text-sm font-medium">{p.name}</span>
						<span class="block text-[11px]" style="color: var(--color-text-3);">{p.school}</span>
					</td>
					{#each judges as j (j.id)}
						{@const isAssigned = p.assignedJudgeId === j.id}
						{@const isPending = pending.has(p.id)}
						<td class="px-1 py-1 text-center">
							<button
								type="button"
								class="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] transition hover:bg-[color:var(--accent-soft)] disabled:opacity-40"
								disabled={isPending}
								aria-pressed={isAssigned}
								aria-label="{isAssigned
									? 'Unassign'
									: 'Assign'} {p.name} to {j.name}"
								onclick={() => onassign?.(p.id, isAssigned ? null : j.id)}
							>
								{#if isAssigned}
									<span
										class="inline-block h-3 w-3 rounded-full"
										style="background: var(--color-accent);"
									></span>
								{:else}
									<span
										class="inline-block h-2 w-2 rounded-full"
										style="background: var(--color-bg-3);"
									></span>
								{/if}
							</button>
						</td>
					{/each}
				</tr>
			{/each}
			{#if participants.length === 0}
				<tr>
					<td colspan={judges.length + 1} class="px-6 py-10 text-center" style="color: var(--color-text-2);">
						No participants in this category yet.
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>
