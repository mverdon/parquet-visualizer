<script lang="ts">
	import FileDropzone from '$lib/components/FileDropzone.svelte';
	import SchemaViewer from '$lib/components/SchemaViewer.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import DataGrid from '$lib/components/DataGrid.svelte';
	import DataGridToolbar from '$lib/components/DataGridToolbar.svelte';
	import SqlQueryInterface from '$lib/components/SqlQueryInterface.svelte';
	import FilterBuilder from '$lib/components/FilterBuilder.svelte';
	import ErrorDisplay from '$lib/components/ErrorDisplay.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { loadParquetFile } from '$lib/parquet-loader';
	import { getTableSchema, getRowCount, executeQuery } from '$lib/duckdb';
	import { parseColumnSchema, type ColumnSchema } from '$lib/schema-utils';
	import { Database, ChevronDown, ChevronUp } from 'lucide-svelte';

	interface LoadedFile {
		name: string;
		tableName: string;
		size: number;
		columns: ColumnSchema[];
		rowCount: number;
	}

	interface FileGroup {
		groupName: string; // User-friendly group name
		files: LoadedFile[];
		columns: ColumnSchema[];
		totalRows: number;
		totalSize: number;
	}

	let loadedFiles = $state<LoadedFile[]>([]);
	let fileGroups = $state<FileGroup[]>([]);
	let currentGroup = $state<FileGroup | null>(null);
	let dataGridRef = $state<{ component: any }>({ component: undefined });
	let visibleColumns = $state<string[]>([]);
	let currentPageData = $state<any[]>([]);
	let currentPageNumber = $state(0);
	let pageSize = $state(100);
	let totalPages = $state(0);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Collapsible sections state
	let schemaExpanded = $state(true);
	let dataGridExpanded = $state(true);
	let sqlQueryExpanded = $state(false);

	// Track which groups have expanded file lists
	let expandedGroups = $state<Set<string>>(new Set());
	const maxFilesShown = 10;

	// Helper function to check if two schemas match
	function schemasMatch(schema1: ColumnSchema[], schema2: ColumnSchema[]): boolean {
		if (schema1.length !== schema2.length) return false;

		for (let i = 0; i < schema1.length; i++) {
			if (schema1[i].name !== schema2[i].name || schema1[i].type !== schema2[i].type) {
				return false;
			}
		}
		return true;
	}

	// Group files with matching schemas
	function groupFiles(files: LoadedFile[]): FileGroup[] {
		const groups: FileGroup[] = [];

		for (const file of files) {
			// Find existing group with matching schema
			const existingGroup = groups.find(g => schemasMatch(g.columns, file.columns));

			if (existingGroup) {
				// Add to existing group
				existingGroup.files.push(file);
				existingGroup.totalRows += (file.rowCount || 0);
				existingGroup.totalSize += file.size;
				// Update group name to show pattern
				existingGroup.groupName = findCommonPattern(existingGroup.files.map(f => f.name));
			} else {
				// Create new group
				groups.push({
					groupName: file.name,
					files: [file],
					columns: file.columns,
					totalRows: (file.rowCount || 0),
					totalSize: file.size
				});
			}
		}

		return groups;
	}

	// Find common pattern in filenames
	function findCommonPattern(names: string[]): string {
		if (names.length === 1) return names[0];

		// Find longest common prefix
		const sorted = names.slice().sort();
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		let i = 0;
		while (i < first.length && first[i] === last[i]) i++;
		const prefix = first.substring(0, i);

		// Find longest common suffix
		let j = 0;
		while (j < first.length && first[first.length - 1 - j] === last[last.length - 1 - j]) j++;
		const suffix = first.substring(first.length - j);

		// Create pattern
		if (prefix || suffix) {
			return `${prefix}*${suffix}`.replace('**', '*');
		}

		return `${names.length} files`;
	}

	async function loadPage(pageNumber: number) {
		if (!currentGroup) return;

		try {
			const offset = pageNumber * pageSize;

			// If single file, simple query
			if (currentGroup.files.length === 1) {
				const query = `SELECT * FROM '${currentGroup.files[0].tableName}' LIMIT ${pageSize} OFFSET ${offset}`;
				const result = await executeQuery(query);
				currentPageData = result;
			} else {
				// Multiple files - use UNION ALL
				const unionQuery = currentGroup.files
					.map(f => `SELECT * FROM '${f.tableName}'`)
					.join(' UNION ALL ');
				const query = `SELECT * FROM (${unionQuery}) LIMIT ${pageSize} OFFSET ${offset}`;
				const result = await executeQuery(query);
				currentPageData = result;
			}

			currentPageNumber = pageNumber;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load page';
			console.error('Error loading page:', e);
		}
	}

	async function handleFilesSelected(files: File[]) {
		if (files.length === 0) return;

		loading = true;
		error = null;
		const newFiles: LoadedFile[] = [];

		try {
			// Load all selected files
			for (const file of files) {
				// Load the file
				const loaded = await loadParquetFile(file);

				// Get schema
				const schemaResult = await getTableSchema(`'${loaded.tableName}'`);
				const columns = parseColumnSchema(schemaResult);

				// Get row count
				const rowCount = await getRowCount(`'${loaded.tableName}'`);

				newFiles.push({
					name: loaded.name,
					tableName: loaded.tableName,
					size: loaded.size,
					columns,
					rowCount
				});
			}

			// Add to loaded files
			loadedFiles = [...loadedFiles, ...newFiles];

			// Regroup all files
			fileGroups = groupFiles(loadedFiles);

			// Set first group as current if none selected
			if (!currentGroup && fileGroups.length > 0) {
				await switchToGroup(fileGroups[0]);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load file';
			console.error('Error loading file:', e);
		} finally {
			loading = false;
		}
	}

	async function switchToGroup(group: FileGroup) {
		currentGroup = group;
		totalPages = Math.ceil(group.totalRows / pageSize);
		await loadPage(0);
	}

	function resetFiles() {
		loadedFiles = [];
		fileGroups = [];
		currentGroup = null;
		error = null;
		visibleColumns = [];
		currentPageData = [];
		currentPageNumber = 0;
	}

	function removeFile(file: LoadedFile) {
		loadedFiles = loadedFiles.filter((f) => f.tableName !== file.tableName);

		// Regroup remaining files
		fileGroups = groupFiles(loadedFiles);

		// If current group no longer exists or is empty, switch to another or null
		const stillExists = fileGroups.some(g =>
			g.files.some(f => currentGroup?.files.some(cf => cf.tableName === f.tableName))
		);

		if (!stillExists) {
			if (fileGroups.length > 0) {
				switchToGroup(fileGroups[0]);
			} else {
				currentGroup = null;
				currentPageData = [];
			}
		} else {
			// Update current group reference
			const updatedGroup = fileGroups.find(g =>
				g.files.some(f => currentGroup?.files.some(cf => cf.tableName === f.tableName))
			);
			if (updatedGroup) {
				switchToGroup(updatedGroup);
			}
		}
	}

	function handleToggleColumn(column: string, visible: boolean) {
		if (dataGridRef.component) {
			dataGridRef.component.toggleColumn(column, visible);
		}
	}

	function handleExport() {
		if (dataGridRef.component) {
			dataGridRef.component.exportToCsv();
		}
	}

	function handleColumnVisibilityChange(visible: string[]) {
		visibleColumns = visible;
	}

	async function handlePageChange(page: number) {
		await loadPage(page);
	}

	async function handlePageSizeChange(newSize: number) {
		if (!currentGroup) return;
		pageSize = newSize;
		totalPages = Math.ceil(currentGroup.totalRows / pageSize);
		// Reload current page with new size
		await loadPage(0);
	}

	async function handleApplyFilter(whereClause: string) {
		if (!currentGroup) return;

		try {
			const tableName = currentGroup.files.length === 1
				? `'${currentGroup.files[0].tableName}'`
				: `(${currentGroup.files.map(f => `SELECT * FROM '${f.tableName}'`).join(' UNION ALL ')})`;

			const query = `SELECT * FROM ${tableName} WHERE ${whereClause} LIMIT ${pageSize}`;
			const result = await executeQuery(query);
			currentPageData = result;
			currentPageNumber = 0;

			// Update total pages based on filtered results (approximate)
			// In production, you'd want to count filtered results
			totalPages = Math.ceil(result.length / pageSize);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to apply filter';
			console.error('Error applying filter:', e);
		}
	}

	// Derived values for SQL interface
	// Use group names instead of individual file names to avoid showing thousands of files
	const allTableNames = $derived(fileGroups.map((g) => g.groupName));

	function toggleGroupExpanded(groupName: string) {
		const newSet = new Set(expandedGroups);
		if (newSet.has(groupName)) {
			newSet.delete(groupName);
		} else {
			newSet.add(groupName);
		}
		expandedGroups = newSet;
	}

	function getVisibleFiles(group: FileGroup) {
		if (expandedGroups.has(group.groupName)) {
			return group.files;
		}
		return group.files.slice(0, maxFilesShown);
	}



</script>

<div class="min-h-screen bg-muted">
	<!-- Header -->
	<header class="border-b border-border bg-background/95 backdrop-blur">
		<div class="max-w-7xl mx-auto px-4 py-3 md:py-4">
			<div class="flex items-center gap-2 md:gap-3">
				<Database class="w-6 h-6 md:w-8 md:h-8 text-accent flex-shrink-0" />
				<div class="min-w-0 flex-1">
					<h1 class="text-xl md:text-2xl font-bold">Parquet Visualizer</h1>
					<p class="text-xs md:text-sm text-muted-foreground hidden sm:block">
						Load and explore Parquet files with SQL queries
					</p>
				</div>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 py-6">
		{#if loadedFiles.length === 0}
			<div class="max-w-2xl mx-auto">
				<FileDropzone onFilesSelected={handleFilesSelected} />

				{#if loading}
					<div class="mt-8 text-center">
						<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
						<p class="mt-4 text-muted-foreground">Loading Parquet files...</p>
					</div>
				{/if}

				{#if error}
					<div class="mt-8">
						<ErrorDisplay
							error={error}
							title="Failed to Load File"
							onDismiss={() => error = null}
							showDetails={true}
						/>
					</div>
				{/if}
			</div>
		{:else}
			<div class="space-y-6">
				<!-- Actions Bar -->
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<h2 class="text-lg md:text-xl font-semibold truncate m-0">
						{fileGroups.length} {fileGroups.length === 1 ? 'Table' : 'Tables'} ({loadedFiles.length} {loadedFiles.length === 1 ? 'file' : 'files'})
					</h2>
					<div class="flex gap-2">
						<Button variant="outline" onclick={resetFiles}>Clear All Files</Button>
					</div>
				</div>

				<!-- Tables + File Statistics (side by side on desktop) -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
					<div class="lg:col-span-2">
						<Card class="h-full flex flex-col">
							<h3 class="text-base md:text-lg font-semibold mb-3">Tables</h3>
							<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
								{#each fileGroups as group}
									<div class="border rounded-lg p-2.5 md:p-3 {currentGroup === group ? 'border-accent bg-accent/5' : 'border-border'}">
										<button
											onclick={() => switchToGroup(group)}
											class="w-full text-left"
										>
											<div class="font-medium text-sm md:text-base truncate">{group.groupName}</div>
											<div class="text-xs md:text-sm text-muted-foreground mt-1">
												{group.totalRows.toLocaleString()} rows × {group.columns.length} columns
												{#if group.files.length > 1}
													<span class="ml-2 text-accent">({group.files.length} files combined)</span>
												{/if}
											</div>
										</button>

										<!-- Show individual files in this group -->
										{#if group.files.length > 1}
											<div class="ml-3 md:ml-4 mt-2 space-y-1">
												{#each getVisibleFiles(group) as file}
													<div class="flex items-center gap-2 text-xs md:text-sm">
														<span class="text-muted-foreground truncate flex-1">↳ {file.name}</span>
														<span class="text-muted-foreground whitespace-nowrap">({(file.rowCount || 0).toLocaleString()} rows)</span>
														<button
															onclick={(e) => { e.stopPropagation(); removeFile(file); }}
															class="ml-auto px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded flex-shrink-0"
															title="Remove file"
														>
															Remove
														</button>
													</div>
												{/each}
												{#if group.files.length > maxFilesShown}
													<button
														onclick={(e) => { e.stopPropagation(); toggleGroupExpanded(group.groupName); }}
														class="text-xs text-accent hover:underline ml-3"
													>
														{expandedGroups.has(group.groupName)
															? 'Show Less'
															: `Show More (${group.files.length - maxFilesShown} more files)`}
													</button>
												{/if}
											</div>
										{:else}
											<div class="mt-2">
												<button
													onclick={(e) => { e.stopPropagation(); removeFile(group.files[0]); }}
													class="py-1 text-xs md:text-sm text-destructive hover:bg-destructive/10 rounded border border-transparent hover:border-destructive/20"
													title="Remove file"
												>
													Remove
												</button>
											</div>
										{/if}
									</div>
								{/each}
							</div>
							<div class="mt-4">
								<FileDropzone onFilesSelected={handleFilesSelected} compact={true} />
							</div>
						</Card>
					</div>
					{#if currentGroup}
						<div class="lg:col-span-1">
							<StatsPanel
								fileName={currentGroup.groupName}
								fileSize={currentGroup.totalSize}
								rowCount={currentGroup.totalRows}
								columnCount={currentGroup.columns.length}
							/>
						</div>
					{/if}
				</div>

				{#if currentGroup}
					<!-- Schema Viewer (Collapsible) -->
					<Card class="overflow-hidden">
						<button
							onclick={() => schemaExpanded = !schemaExpanded}
							class="w-full flex items-center justify-between hover:bg-muted/30 transition-colors"
						>
							<h3 class="text-base md:text-lg font-semibold">Schema</h3>
							{#if schemaExpanded}
								<ChevronUp class="w-5 h-5 text-muted-foreground" />
							{:else}
								<ChevronDown class="w-5 h-5 text-muted-foreground" />
							{/if}
						</button>
						{#if schemaExpanded}
							<div>
								<SchemaViewer
									columns={currentGroup.columns}
									tableName={currentGroup.files[0].tableName}
								/>
							</div>
						{/if}
					</Card>

					<!-- Data Grid (Collapsible) -->
					<Card class="overflow-hidden">
						<button
							onclick={() => dataGridExpanded = !dataGridExpanded}
							class="w-full flex items-center justify-between hover:bg-muted/30 transition-colors"
						>
							<h3 class="text-base md:text-lg font-semibold">Data Browser</h3>
							{#if dataGridExpanded}
								<ChevronUp class="w-5 h-5 text-muted-foreground" />
							{:else}
								<ChevronDown class="w-5 h-5 text-muted-foreground" />
							{/if}
						</button>

						{#if dataGridExpanded}
							<div>
								<FilterBuilder
									columns={currentGroup.columns.map((c) => c.name)}
									onApplyFilter={handleApplyFilter}
								/>
							</div>

							<DataGridToolbar
								allColumns={currentGroup.columns.map((c) => c.name)}
								visibleColumns={visibleColumns}
								currentPage={currentPageNumber}
								totalPages={totalPages}
								totalRows={currentGroup.totalRows}
								pageSize={pageSize}
								onToggleColumn={handleToggleColumn}
								onPageChange={handlePageChange}
								onPageSizeChange={handlePageSizeChange}
								onExport={handleExport}
							/>

							<DataGrid
								bind:this={dataGridRef.component}
								data={currentPageData}
								columns={currentGroup.columns.map((c) => c.name)}
								height="600px"
								onColumnVisibilityChange={handleColumnVisibilityChange}
							/>
						{/if}
					</Card>

					<!-- SQL Query Interface (Collapsible) -->
					<Card class="overflow-hidden">
						<button
							onclick={() => sqlQueryExpanded = !sqlQueryExpanded}
							class="w-full flex items-center justify-between hover:bg-muted/30 transition-colors"
						>
							<h3 class="text-base md:text-lg font-semibold">SQL Query Interface</h3>
							{#if sqlQueryExpanded}
								<ChevronUp class="w-5 h-5 text-muted-foreground" />
							{:else}
								<ChevronDown class="w-5 h-5 text-muted-foreground" />
							{/if}
						</button>
						{#if sqlQueryExpanded}
							<div>
								<SqlQueryInterface
									tableName={currentGroup.files.length === 1 ? currentGroup.files[0].tableName : currentGroup.groupName}
									columns={currentGroup.columns.map((c) => c.name)}
									allTables={allTableNames}
								/>
							</div>
						{/if}
					</Card>
				{/if}
			</div>
		{/if}
	</main>
</div>
