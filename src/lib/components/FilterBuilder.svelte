<script lang="ts">
	import Button from './ui/Button.svelte';
	import { Plus, Trash2, Play } from 'lucide-svelte';

	interface Props {
		columns: string[];
		onApplyFilter: (whereClause: string) => void;
	}

	interface Filter {
		id: number;
		column: string;
		operator: string;
		value: string;
		logic: 'AND' | 'OR';
	}

	let { columns, onApplyFilter }: Props = $props();

	let filters = $state<Filter[]>([]);
	let nextId = $state(1);

	const operators = [
		{ value: '=', label: 'equals' },
		{ value: '!=', label: 'not equals' },
		{ value: '>', label: 'greater than' },
		{ value: '<', label: 'less than' },
		{ value: '>=', label: 'greater or equal' },
		{ value: '<=', label: 'less or equal' },
		{ value: 'LIKE', label: 'contains' },
		{ value: 'NOT LIKE', label: 'does not contain' },
		{ value: 'IS NULL', label: 'is null' },
		{ value: 'IS NOT NULL', label: 'is not null' }
	];

	function addFilter() {
		filters.push({
			id: nextId++,
			column: columns[0] || '',
			operator: '=',
			value: '',
			logic: 'AND'
		});
		filters = filters;
	}

	function removeFilter(id: number) {
		filters = filters.filter(f => f.id !== id);
	}

	function generateWhereClause(): string {
		if (filters.length === 0) return '';

		const clauses = filters.map((filter, index) => {
			let clause = '';

			// Add logic operator (AND/OR) before the condition (except for first filter)
			if (index > 0) {
				clause += ` ${filter.logic} `;
			}

			// Build the condition
			const needsValue = !['IS NULL', 'IS NOT NULL'].includes(filter.operator);

			if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
				clause += `"${filter.column}" ${filter.operator} '%${filter.value}%'`;
			} else if (needsValue) {
				// Try to parse as number, otherwise treat as string
				const numValue = Number(filter.value);
				const valueStr = isNaN(numValue) ? `'${filter.value}'` : filter.value;
				clause += `"${filter.column}" ${filter.operator} ${valueStr}`;
			} else {
				clause += `"${filter.column}" ${filter.operator}`;
			}

			return clause;
		});

		return clauses.join('');
	}

	function applyFilter() {
		const whereClause = generateWhereClause();
		if (whereClause) {
			onApplyFilter(whereClause);
		}
	}

	function clearFilters() {
		filters = [];
	}

	const previewClause = $derived(generateWhereClause());
</script>

<div class=" py-3 md:py-4">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
		<div class="flex gap-2">
			<Button size="sm" variant="outline" onclick={addFilter}>
				<Plus class="w-4 h-4 mr-1" />
				Add Filter
			</Button>
		</div>
	</div>

	{#if filters.length === 0}
		<div class="text-center py-8 text-muted-foreground">
			<p class="text-sm">No filters applied</p>
			<p class="text-xs mt-1">Click "Add Filter" to start building your query</p>
		</div>
	{:else}
		<div class="space-y-3 mb-4">
			{#each filters as filter, index}
				<div class="flex items-start gap-2 p-3 border border-border rounded-md bg-muted/20">
					{#if index > 0}
						<select
							bind:value={filter.logic}
							class="px-2 py-1 text-sm border border-border rounded bg-background"
						>
							<option value="AND">AND</option>
							<option value="OR">OR</option>
						</select>
					{/if}

					<select
						bind:value={filter.column}
						class="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
					>
						{#each columns as col}
							<option value={col}>{col}</option>
						{/each}
					</select>

					<select
						bind:value={filter.operator}
						class="px-2 py-1 text-sm border border-border rounded bg-background"
					>
						{#each operators as op}
							<option value={op.value}>{op.label}</option>
						{/each}
					</select>

					{#if !['IS NULL', 'IS NOT NULL'].includes(filter.operator)}
						<input
							type="text"
							bind:value={filter.value}
							placeholder="value"
							class="flex-1 px-2 py-1 text-sm border border-border rounded bg-background"
						/>
					{/if}

					<button
						onclick={() => removeFilter(filter.id)}
						class="p-1 text-destructive hover:bg-destructive/10 rounded"
						title="Remove filter"
					>
						<Trash2 class="w-4 h-4" />
					</button>
				</div>
			{/each}
		</div>

		<!-- Preview -->
		{#if previewClause}
			<div class="mb-4 p-3 bg-muted/30 rounded-md border border-border">
				<div class="text-xs text-muted-foreground uppercase mb-1">WHERE Clause Preview</div>
				<div class="font-mono text-sm">{previewClause}</div>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex gap-2">
			<Button onclick={applyFilter} disabled={!previewClause}>
				<Play class="w-4 h-4 mr-2" />
				Apply Filter
			</Button>
			<Button variant="outline" onclick={clearFilters}>
				Clear All
			</Button>
		</div>
	{/if}
</div>
