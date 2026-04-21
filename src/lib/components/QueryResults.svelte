<script lang="ts">
	import DataGrid from './DataGrid.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import Badge from './ui/Badge.svelte';
	import { Download, Clock, Database } from 'lucide-svelte';
	import { formatNumber } from '$lib/schema-utils';

	interface Props {
		results?: any[];
		columns?: string[];
		executionTime?: number;
		error?: string | null;
		isExecuting?: boolean;
	}

	let {
		results = [],
		columns = [],
		executionTime = 0,
		error = null,
		isExecuting = false
	}: Props = $props();

	let gridRef = $state<any>(undefined);

	function handleExport() {
		if (gridRef) {
			gridRef.exportToCsv();
		}
	}

	function handleExportJSON() {
		const jsonStr = JSON.stringify(results, null, 2);
		const blob = new Blob([jsonStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `query-results-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

{#if error}
	<Card class="border-destructive bg-destructive/5 p-4">
		<div class="flex items-start gap-3">
			<div class="text-destructive">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
			</div>
			<div class="flex-1">
				<h4 class="font-semibold text-destructive mb-1">Query Error</h4>
				<p class="text-sm text-destructive/80 font-mono">{error}</p>
			</div>
		</div>
	</Card>
{:else if isExecuting}
	<Card class="p-8">
		<div class="flex flex-col items-center justify-center gap-4">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
			<p class="text-muted-foreground">Executing query...</p>
		</div>
	</Card>
{:else if results.length === 0}
	<Card class="p-8">
		<div class="flex flex-col items-center justify-center gap-4 text-muted-foreground">
			<Database class="w-12 h-12 opacity-50" />
			<div class="text-center">
				<p class="font-medium">No results yet</p>
				<p class="text-sm mt-1">Run a SQL query to see results here</p>
			</div>
		</div>
	</Card>
{:else}
	<Card class="overflow-hidden p-0">
		<!-- Results Header -->
		<div class="p-4 border-b border-border bg-muted/30">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<Database class="w-4 h-4 text-muted-foreground" />
						<span class="text-sm font-medium">{formatNumber(results.length)} rows</span>
					</div>
					{#if executionTime > 0}
						<div class="flex items-center gap-2">
							<Clock class="w-4 h-4 text-muted-foreground" />
							<span class="text-sm text-muted-foreground">{executionTime}ms</span>
						</div>
					{/if}
					<Badge variant="default">{columns.length} columns</Badge>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={handleExport}>
						<Download class="w-4 h-4 mr-2" />
						Export CSV
					</Button>
					<Button variant="outline" size="sm" onclick={handleExportJSON}>
						<Download class="w-4 h-4 mr-2" />
						Export JSON
					</Button>
				</div>
			</div>
		</div>

		<!-- Results Grid -->
		<DataGrid
			bind:this={gridRef}
			data={results}
			columns={columns}
			height="400px"
		/>
	</Card>
{/if}
