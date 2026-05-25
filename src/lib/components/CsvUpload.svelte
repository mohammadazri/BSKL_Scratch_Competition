<!--
	CsvUpload — file picker → in-memory preview → commit button.
	Caller passes `headersExpected` (validates header set) and `oncommit` is
	called with the parsed rows. Bring-your-own server action.
-->
<script lang="ts">
	import { parseCsv } from '$lib/utils/csv';
	import Button from './Button.svelte';
	import { Upload, FileText, AlertTriangle } from '@lucide/svelte';

	interface Props {
		headersExpected: string[];
		oncommit?: (rows: Record<string, string>[]) => void | Promise<void>;
		committing?: boolean;
		maxPreview?: number;
	}

	let {
		headersExpected,
		oncommit,
		committing = false,
		maxPreview = 10
	}: Props = $props();

	let file = $state<File | null>(null);
	let parseErrors = $state<{ line: number; message: string }[]>([]);
	let missingHeaders = $state<string[]>([]);
	let rows = $state<Record<string, string>[]>([]);
	let pickerId = `csv-${Math.random().toString(36).slice(2, 8)}`;

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0] ?? null;
		file = f;
		rows = [];
		parseErrors = [];
		missingHeaders = [];
		if (!f) return;
		const text = await f.text();
		const parsed = parseCsv(text);
		missingHeaders = headersExpected.filter((h) => !parsed.headers.includes(h));
		parseErrors = parsed.errors;
		rows = parsed.rows;
	}

	function reset() {
		file = null;
		rows = [];
		parseErrors = [];
		missingHeaders = [];
	}

	async function commit() {
		if (!oncommit) return;
		await oncommit(rows);
	}
</script>

<div class="flex flex-col gap-4">
	<div
		class="flex flex-col items-center justify-center gap-3 rounded-[var(--radius)] border border-dashed px-6 py-8 text-center"
		style="border-color: var(--border-strong); background: var(--color-bg-1);"
	>
		<div
			class="grid h-12 w-12 place-items-center rounded-full"
			style="background: var(--color-bg-3); color: var(--color-text-2);"
		>
			<Upload size={20} strokeWidth={1.5} />
		</div>
		<div>
			<p class="text-sm font-semibold" style="color: var(--color-text-1);">
				{file ? file.name : 'Choose a CSV file'}
			</p>
			<p class="mt-1 text-xs" style="color: var(--color-text-2);">
				Expected headers: <span style="font-family: var(--font-mono);"
					>{headersExpected.join(', ')}</span
				>
			</p>
		</div>
		<label
			for={pickerId}
			class="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
			style="background: var(--color-bg-3); color: var(--color-text-1); border: 1px solid var(--border-strong); min-height: 44px;"
		>
			<FileText size={16} strokeWidth={1.5} />
			{file ? 'Choose another file' : 'Select file'}
		</label>
		<input
			id={pickerId}
			type="file"
			accept=".csv,text/csv"
			class="sr-only"
			onchange={onFile}
		/>
	</div>

	{#if missingHeaders.length > 0}
		<div
			class="flex items-start gap-2 rounded-[var(--radius)] border p-3 text-sm"
			style="border-color: var(--color-danger); background: rgba(239, 68, 68, 0.06); color: var(--color-danger);"
		>
			<AlertTriangle size={16} strokeWidth={1.5} />
			<div>
				Missing required headers: <span style="font-family: var(--font-mono);"
					>{missingHeaders.join(', ')}</span
				>
			</div>
		</div>
	{/if}

	{#if parseErrors.length > 0}
		<div
			class="rounded-[var(--radius)] border p-3 text-sm"
			style="border-color: var(--color-warning); background: rgba(245, 158, 11, 0.06); color: var(--color-warning);"
		>
			<p class="mb-2 font-semibold">
				{parseErrors.length} malformed row{parseErrors.length === 1 ? '' : 's'} — rejected:
			</p>
			<ul class="space-y-0.5 text-xs">
				{#each parseErrors.slice(0, 10) as err (err.line)}
					<li>line {err.line}: {err.message}</li>
				{/each}
				{#if parseErrors.length > 10}
					<li>… and {parseErrors.length - 10} more</li>
				{/if}
			</ul>
		</div>
	{/if}

	{#if rows.length > 0 && missingHeaders.length === 0}
		<div>
			<p class="mb-2 text-xs font-medium tracking-wider uppercase" style="color: var(--color-text-2);">
				Preview — {rows.length} row{rows.length === 1 ? '' : 's'} (showing first {Math.min(
					maxPreview,
					rows.length
				)})
			</p>
			<div
				class="overflow-x-auto rounded-[var(--radius)] border"
				style="border-color: var(--border);"
			>
				<table class="w-full border-collapse text-sm">
					<thead>
						<tr style="background: var(--color-bg-3);">
							{#each headersExpected as h (h)}
								<th
									class="px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
									style="color: var(--color-text-2);"
								>
									{h}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each rows.slice(0, maxPreview) as row, i (i)}
							<tr
								class="border-t"
								style="border-color: var(--border); background: {i % 2 === 0
									? 'var(--color-bg-1)'
									: 'var(--color-bg-2)'};"
							>
								{#each headersExpected as h (h)}
									<td class="px-3 py-2" style="color: var(--color-text-1);">{row[h] ?? ''}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="flex justify-end gap-2">
			<Button variant="ghost" onclick={reset} disabled={committing}>Reset</Button>
			<Button variant="primary" onclick={commit} loading={committing}>
				Import {rows.length} row{rows.length === 1 ? '' : 's'}
			</Button>
		</div>
	{/if}
</div>
