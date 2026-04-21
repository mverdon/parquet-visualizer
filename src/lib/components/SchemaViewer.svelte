<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getTypeColor, formatNumber } from '$lib/schema-utils';
	import type { ColumnSchema } from '$lib/schema-utils';
	import { getColumnStats } from '$lib/duckdb';
	import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-svelte';

	interface Props {
		columns: ColumnSchema[];
		tableName?: string;
	}

	interface ColumnStats {
		type: string;
		count: number;
		null_count: number;
		// Numeric/Date types
		min?: any;
		max?: any;
		avg?: any;
		// String types
		distinct_count?: number;
		samples?: string[];
		// Array types
		min_element?: any;
		max_element?: any;
		avg_element?: any;
		// Boolean types
		true_count?: number;
		false_count?: number;
	}

	let { columns, tableName }: Props = $props();
	let expandedColumns = $state<Set<string>>(new Set());
	let columnStats = $state<Map<string, ColumnStats>>(new Map());
	let loadingStats = $state<Set<string>>(new Set());

	async function toggleColumnStats(columnName: string, columnType: string) {
		if (expandedColumns.has(columnName)) {
			expandedColumns.delete(columnName);
			expandedColumns = new Set(expandedColumns);
		} else {
			expandedColumns.add(columnName);
			expandedColumns = new Set(expandedColumns);

			// Fetch stats if not already loaded
			if (!columnStats.has(columnName) && tableName) {
				loadingStats.add(columnName);
				loadingStats = new Set(loadingStats);

				try {
					const stats = await getColumnStats(`'${tableName}'`, columnName, columnType);
					columnStats.set(columnName, stats);
					columnStats = new Map(columnStats);
				} catch (e) {
					console.error('Failed to load column stats:', e);
					// Remove from expanded columns on error
					expandedColumns.delete(columnName);
					expandedColumns = new Set(expandedColumns);
				} finally {
					loadingStats.delete(columnName);
					loadingStats = new Set(loadingStats);
				}
			}
		}
	}

	function formatStatValue(value: any, type: string): string {
		if (value === null || value === undefined) return 'N/A';

		if (type.toLowerCase().includes('int') || type.toLowerCase().includes('double') || type.toLowerCase().includes('float') || type.toLowerCase().includes('decimal')) {
			return formatNumber(Number(value));
		}

		if (type.toLowerCase().includes('date') || type.toLowerCase().includes('timestamp')) {
			return new Date(value).toLocaleString();
		}

		return String(value);
	}
</script>

<div class="overflow-x-auto py-3 md:py-4">
	<table class="w-full text-sm">
		<thead class="border-b border-border">
			<tr class="text-left">
				<th class="py-2 px-2 md:px-3 font-medium w-8 md:w-10"></th>
				<th class="py-2 px-2 md:px-3 font-medium">Column Name</th>
				<th class="py-2 px-2 md:px-3 font-medium">Type</th>
				<th class="py-2 px-2 md:px-3 font-medium">Nullable</th>
				{#if tableName}
						<th class="py-2 px-2 md:px-3 font-medium">Actions</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each columns as column}
					<tr class="border-b border-border hover:bg-muted/30">
						<td class="py-2 px-2 md:px-3">
							{#if tableName}
								<button
									onclick={() => toggleColumnStats(column.name, column.type)}
									class="text-muted-foreground hover:text-foreground transition-colors"
									title="Toggle statistics"
								>
									{#if expandedColumns.has(column.name)}
										<ChevronDown class="w-4 h-4" />
									{:else}
										<ChevronRight class="w-4 h-4" />
									{/if}
								</button>
							{/if}
						</td>
						<td class="py-2 px-2 md:px-3 font-mono text-xs md:text-sm">{column.name}</td>
						<td class="py-2 px-2 md:px-3">
							<Badge variant="default">
								<span class={getTypeColor(column.type)}>
									{column.type}
								</span>
							</Badge>
						</td>
						<td class="py-2 px-2 md:px-3">
							{#if column.nullable}
								<span class="text-muted-foreground text-xs md:text-sm">Yes</span>
							{:else}
								<span class="text-foreground font-medium text-xs md:text-sm">No</span>
							{/if}
						</td>
						{#if tableName}
							<td class="py-2 px-2 md:px-3">
								<Button
									size="sm"
									variant="ghost"
									onclick={() => toggleColumnStats(column.name, column.type)}
								>
									<BarChart3 class="w-4 h-4 mr-1" />
									<span class="hidden sm:inline">Stats</span>
								</Button>
							</td>
						{/if}
					</tr>
					{#if expandedColumns.has(column.name)}
					<tr class="border-b border-border bg-muted/20">
							<td colspan={tableName ? 5 : 4} class="py-3 px-3">
								{#if loadingStats.has(column.name)}
									<div class="flex items-center gap-2 text-sm text-muted-foreground">
										<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
										Loading statistics...
									</div>
								{:else if columnStats.has(column.name)}
									{@const stats = columnStats.get(column.name)}
									{#if stats}
										<!-- Type-specific stats -->
										{#if stats.type === 'numeric'}
											<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Min</div>
													<div class="font-mono text-sm">{formatStatValue(stats.min, column.type)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Max</div>
													<div class="font-mono text-sm">{formatStatValue(stats.max, column.type)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Average</div>
													<div class="font-mono text-sm">{formatStatValue(stats.avg, column.type)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
												</div>
											</div>
										{:else if stats.type === 'date'}
											<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Min</div>
													<div class="font-mono text-sm">{formatStatValue(stats.min, column.type)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Max</div>
													<div class="font-mono text-sm">{formatStatValue(stats.max, column.type)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
												</div>
											</div>
										{:else if stats.type === 'string'}
											<div class="space-y-3">
												<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Distinct Values</div>
														<div class="font-mono text-sm">{formatNumber(stats.distinct_count || 0)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
													</div>
												</div>
												{#if stats.samples && Array.isArray(stats.samples) && stats.samples.length > 0}
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Sample Values</div>
														<div class="flex flex-wrap gap-1">
															{#each stats.samples as sample}
																<Badge variant="outline" class="font-mono text-xs">{sample ?? 'null'}</Badge>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										{:else if stats.type === 'blob'}
											<div class="space-y-3">
												<div class="grid grid-cols-2 gap-4">
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
													</div>
												</div>
												{#if stats.samples && Array.isArray(stats.samples) && stats.samples.length > 0}
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Sample Values (Hex)</div>
														<div class="space-y-1">
															{#each stats.samples as sample}
																<div class="font-mono text-xs bg-background/50 p-1 rounded">{sample ?? 'null'}</div>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										{:else if stats.type === 'array_numeric'}
											<div class="space-y-3">
												<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Min Element</div>
														<div class="font-mono text-sm">{formatStatValue(stats.min_element, column.type)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Max Element</div>
														<div class="font-mono text-sm">{formatStatValue(stats.max_element, column.type)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Avg Element</div>
														<div class="font-mono text-sm">{formatStatValue(stats.avg_element, column.type)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
													</div>
												</div>
												{#if stats.samples && Array.isArray(stats.samples) && stats.samples.length > 0}
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Sample Arrays</div>
														<div class="space-y-1">
															{#each stats.samples as sample}
																<div class="font-mono text-xs bg-background/50 p-1 rounded">{JSON.stringify(sample)}</div>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										{:else if stats.type === 'array_other'}
											<div class="space-y-3">
												<div class="grid grid-cols-2 gap-4">
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
													</div>
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
														<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
													</div>
												</div>
												{#if stats.samples && Array.isArray(stats.samples) && stats.samples.length > 0}
													<div>
														<div class="text-xs text-muted-foreground uppercase mb-1">Sample Arrays</div>
														<div class="space-y-1">
															{#each stats.samples as sample}
																<div class="font-mono text-xs bg-background/50 p-1 rounded">{JSON.stringify(sample)}</div>
															{/each}
														</div>
													</div>
												{/if}
											</div>
										{:else if stats.type === 'boolean'}
											<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">True Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.true_count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">False Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.false_count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
												</div>
											</div>
										{:else}
											<!-- Default: just counts -->
											<div class="grid grid-cols-2 gap-4">
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Non-Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.count || 0)}</div>
												</div>
												<div>
													<div class="text-xs text-muted-foreground uppercase mb-1">Null Count</div>
													<div class="font-mono text-sm">{formatNumber(stats.null_count || 0)}</div>
												</div>
											</div>
										{/if}
									{/if}
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
