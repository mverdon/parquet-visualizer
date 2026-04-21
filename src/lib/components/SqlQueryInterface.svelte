<script lang="ts">
	import SqlEditor from './SqlEditor.svelte';
	import QueryResults from './QueryResults.svelte';
	import Button from './ui/Button.svelte';
	import Badge from './ui/Badge.svelte';
	import { Play, History, Code, ChevronDown, Trash2 } from 'lucide-svelte';
	import { executeQuery } from '$lib/duckdb';
	import { onMount } from 'svelte';

	interface Props {
		tableName?: string;
		columns?: string[];
		allTables?: string[];
	}

	let { tableName = '', columns = [], allTables = [] }: Props = $props();

	interface QueryHistoryItem {
		id: string;
		query: string;
		timestamp: number;
		success: boolean;
		rowCount?: number;
		executionTime?: number;
	}

	let editorRef = $state<any>(undefined);
	let currentQuery = $state('');
	let queryResults = $state<any[]>([]);
	let resultColumns = $state<string[]>([]);
	let executionTime = $state(0);
	let queryError = $state<string | null>(null);
	let isExecuting = $state(false);
	let queryHistory = $state<QueryHistoryItem[]>([]);
	let showHistory = $state(false);
	let showTemplates = $state(false);

	const HISTORY_KEY = 'parquet-visualizer-query-history';
	const MAX_HISTORY = 20;

	// Example query templates - reactive to tableName changes
	const templates = $derived.by(() => {
		const baseTemplates = [
			{
				name: 'Select All',
				description: 'View all columns and rows',
				query: `SELECT * FROM '${tableName}' LIMIT 100`
			},
			{
				name: 'Count Rows',
				description: 'Get total row count',
				query: `SELECT COUNT(*) as total_rows FROM '${tableName}'`
			},
			{
				name: 'Column Statistics',
				description: 'Get min, max, avg for a column',
				query: `SELECT
  MIN(column_name) as min_value,
  MAX(column_name) as max_value,
  AVG(column_name) as avg_value,
  COUNT(*) as total_count
FROM '${tableName}'`
			},
			{
				name: 'Group By',
				description: 'Group and count by column',
				query: `SELECT
  column_name,
  COUNT(*) as count
FROM '${tableName}'
GROUP BY column_name
ORDER BY count DESC
LIMIT 10`
			},
			{
				name: 'Filter Rows',
				description: 'Filter with WHERE clause',
				query: `SELECT * FROM '${tableName}'
WHERE column_name > value
LIMIT 100`
			},
			{
				name: 'Distinct Values',
				description: 'Get unique values',
				query: `SELECT DISTINCT column_name
FROM '${tableName}'
ORDER BY column_name
LIMIT 100`
			}
		];

		// Add multi-table queries if multiple tables are loaded
		if (allTables.length > 1) {
			const otherTable = allTables.find(t => t !== tableName) || allTables[1];
			baseTemplates.push({
				name: 'Join Tables',
				description: 'Join two tables',
				query: `SELECT *
FROM '${tableName}' AS t1
JOIN '${otherTable}' AS t2
  ON t1.id = t2.id
LIMIT 100`
			});

			baseTemplates.push({
				name: 'Union Tables',
				description: 'Combine rows from multiple tables',
				query: `SELECT * FROM '${tableName}'
UNION ALL
SELECT * FROM '${otherTable}'
LIMIT 100`
			});
		}

		return baseTemplates;
	});

	onMount(() => {
		loadHistory();
	});

	function loadHistory() {
		try {
			const stored = localStorage.getItem(HISTORY_KEY);
			if (stored) {
				queryHistory = JSON.parse(stored);
			}
		} catch (e) {
			console.error('Failed to load query history:', e);
		}
	}

	function saveHistory() {
		try {
			// Keep only the most recent MAX_HISTORY items
			const toSave = queryHistory.slice(0, MAX_HISTORY);
			localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
		} catch (e) {
			console.error('Failed to save query history:', e);
		}
	}

	function addToHistory(query: string, success: boolean, rowCount?: number, time?: number) {
		const item: QueryHistoryItem = {
			id: Date.now().toString(),
			query,
			timestamp: Date.now(),
			success,
			rowCount,
			executionTime: time
		};

		queryHistory = [item, ...queryHistory];
		saveHistory();
	}

	async function handleExecuteQuery() {
		if (!currentQuery.trim()) {
			queryError = 'Please enter a SQL query';
			return;
		}

		isExecuting = true;
		queryError = null;
		queryResults = [];
		resultColumns = [];

		const startTime = performance.now();

		try {
			const results = await executeQuery(currentQuery);
			const endTime = performance.now();
			const execTime = Math.round(endTime - startTime);

			executionTime = execTime;
			queryResults = results;

			if (results.length > 0) {
				resultColumns = Object.keys(results[0]);
			}

			addToHistory(currentQuery, true, results.length, execTime);
		} catch (e) {
			queryError = e instanceof Error ? e.message : 'Query execution failed';
			addToHistory(currentQuery, false);
			console.error('Query error:', e);
		} finally {
			isExecuting = false;
		}
	}

	function loadTemplate(template: { query: string }) {
		currentQuery = template.query;
		if (editorRef) {
			editorRef.setValue(template.query);
		}
		showTemplates = false;
	}

	function loadFromHistory(item: QueryHistoryItem) {
		currentQuery = item.query;
		if (editorRef) {
			editorRef.setValue(item.query);
		}
		showHistory = false;
	}

	function clearHistory() {
		if (confirm('Are you sure you want to clear query history?')) {
			queryHistory = [];
			localStorage.removeItem(HISTORY_KEY);
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return date.toLocaleDateString();
	}
</script>

<div class="overflow-hidden">
	<!-- Header with controls -->
	<div class="py-3 md:py-4">
		<div class="flex items-center justify-between">
			<p class="text-xs md:text-sm text-muted-foreground">
				Write and execute SQL queries on your data. Press <kbd class="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">Ctrl+Enter</kbd> to execute.
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showTemplates = !showTemplates)}
				>
					<Code class="w-4 h-4 mr-2" />
					Templates
					<span class:rotate-180={showTemplates}>
						<ChevronDown class="w-4 h-4 ml-2" />
					</span>
				</Button>
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showHistory = !showHistory)}
				>
					<History class="w-4 h-4 mr-2" />
					History
					<span class:rotate-180={showHistory}>
						<ChevronDown class="w-4 h-4 ml-2" />
					</span>
				</Button>
			</div>
		</div>

		<!-- Templates Dropdown -->
		{#if showTemplates}
			<div class="mt-4 grid grid-cols-2 gap-2">
				{#each templates as template}
					<button
						onclick={() => loadTemplate(template)}
						class="text-left p-3 border border-border rounded-md hover:bg-muted/50 transition-colors"
					>
						<div class="font-medium text-sm">{template.name}</div>
						<div class="text-xs text-muted-foreground mt-1">{template.description}</div>
					</button>
				{/each}
			</div>
		{/if}

		<!-- History Dropdown -->
		{#if showHistory}
			<div class="mt-4 max-h-80 overflow-y-auto border border-border rounded-md">
				{#if queryHistory.length === 0}
					<div class="p-4 text-center text-sm text-muted-foreground">
						No query history yet
					</div>
				{:else}
					<div class="flex items-center justify-between p-2 border-b border-border bg-muted/30">
						<span class="text-xs font-medium text-muted-foreground">Recent Queries</span>
						<button
							onclick={clearHistory}
							class="text-xs text-destructive hover:underline flex items-center gap-1"
						>
							<Trash2 class="w-3 h-3" />
							Clear All
						</button>
					</div>
					{#each queryHistory as item}
						<button
							onclick={() => loadFromHistory(item)}
							class="w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors"
						>
							<div class="flex items-start justify-between gap-2 mb-1">
								<code class="text-xs font-mono flex-1 line-clamp-2">{item.query}</code>
								<Badge variant={item.success ? 'default' : 'destructive'} class="text-xs shrink-0">
									{item.success ? 'Success' : 'Error'}
								</Badge>
							</div>
							<div class="flex items-center gap-3 text-xs text-muted-foreground">
								<span>{formatTimestamp(item.timestamp)}</span>
								{#if item.rowCount !== undefined}
									<span>{item.rowCount} rows</span>
								{/if}
								{#if item.executionTime !== undefined}
									<span>{item.executionTime}ms</span>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- SQL Editor -->
	<div class="py-3 md:py-4 bg-muted/10">
		<SqlEditor
			bind:this={editorRef}
			bind:value={currentQuery}
			height="200px"
			placeholder={`-- Enter your SQL query here. Example:\nSELECT * FROM '${tableName}' LIMIT 100`}
			onExecute={handleExecuteQuery}
		/>
		<div class="mt-3 flex items-center justify-between">
			<div class="text-xs text-muted-foreground space-y-1">
				{#if allTables.length > 0}
					<div>
						<strong>Available tables:</strong> {allTables.join(', ')}
					</div>
				{/if}
				{#if columns.length > 0}
					<div>
						<strong>Current table columns:</strong> {columns.join(', ')}
					</div>
				{/if}
			</div>
			<Button onclick={handleExecuteQuery} disabled={isExecuting}>
				<Play class="w-4 h-4 mr-2" />
				{isExecuting ? 'Executing...' : 'Run Query'}
			</Button>
		</div>
	</div>

	<!-- Query Results -->
	<div class="pt-3 md:pt-4">
		<QueryResults
			results={queryResults}
			columns={resultColumns}
			executionTime={executionTime}
			error={queryError}
			isExecuting={isExecuting}
		/>
	</div>
</div>

<style>
	.rotate-180 {
		transform: rotate(180deg);
		transition: transform 0.2s;
	}

	span {
		transition: transform 0.2s;
		display: inline-block;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	kbd {
		font-family: inherit;
	}
</style>
