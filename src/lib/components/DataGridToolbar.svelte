<script lang="ts">
	import { Eye, EyeOff, Download, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import Button from './ui/Button.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		allColumns: string[];
		visibleColumns: string[];
		currentPage?: number;
		totalPages?: number;
		totalRows?: number;
		pageSize?: number;
		availablePageSizes?: number[];
		onToggleColumn: (column: string, visible: boolean) => void;
		onPageChange?: (page: number) => void;
		onPageSizeChange?: (size: number) => void;
		onExport?: () => void;
	}

	let {
		allColumns = [],
		visibleColumns = [],
		currentPage = 0,
		totalPages = 0,
		totalRows = 0,
		pageSize = 100,
		availablePageSizes = [50, 100, 200, 500],
		onToggleColumn,
		onPageChange,
		onPageSizeChange,
		onExport
	}: Props = $props();

	let showColumnMenu = $state(false);
	let showPageSizeMenu = $state(false);

	function isColumnVisible(column: string): boolean {
		return visibleColumns.includes(column);
	}

	function handleToggleColumn(column: string) {
		const isVisible = isColumnVisible(column);
		onToggleColumn(column, !isVisible);
	}

	function handlePrevPage() {
		if (currentPage > 0 && onPageChange) {
			onPageChange(currentPage - 1);
		}
	}

	function handleNextPage() {
		if (currentPage < totalPages - 1 && onPageChange) {
			onPageChange(currentPage + 1);
		}
	}

	function handlePageSizeChange(size: number) {
		if (onPageSizeChange) {
			onPageSizeChange(size);
		}
		showPageSizeMenu = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.column-menu-container')) {
			showColumnMenu = false;
		}
		if (!target.closest('.page-size-menu-container')) {
			showPageSizeMenu = false;
		}
	}

	$effect(() => {
		if (showColumnMenu || showPageSizeMenu) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 bg-muted/30">
	<!-- Left side: Pagination info and controls -->
	<div class="flex flex-wrap items-center gap-2 md:gap-4">
		{#if totalRows > 0}
			<!-- Page size selector -->
			<div class="page-size-menu-container relative">
				<Button
					variant="outline"
					size="sm"
					onclick={() => (showPageSizeMenu = !showPageSizeMenu)}
				>
					{pageSize} per page
					<ChevronDown class="w-4 h-4 ml-1" />
				</Button>

				{#if showPageSizeMenu}
					<div
						class="absolute left-0 mt-2 w-40 bg-background border border-border rounded-lg shadow-lg z-50"
					>
						<div class="p-1">
							{#each availablePageSizes as size}
								<button
									type="button"
									class={cn(
										'w-full px-3 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors',
										pageSize === size ? 'bg-muted font-medium' : ''
									)}
									onclick={() => handlePageSizeChange(size)}
								>
									{size} rows
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Pagination controls -->
			{#if totalPages > 1}
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={handlePrevPage}
						disabled={currentPage === 0}
					>
						<ChevronLeft class="w-4 h-4" />
					</Button>
					<div class="text-sm text-muted-foreground whitespace-nowrap">
						Page <span class="font-medium text-foreground">{currentPage + 1}</span> of
						<span class="font-medium text-foreground">{totalPages}</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={handleNextPage}
						disabled={currentPage >= totalPages - 1}
					>
						<ChevronRight class="w-4 h-4" />
					</Button>
				</div>
			{/if}
			<div class="text-sm text-muted-foreground whitespace-nowrap">
				<span class="font-medium text-foreground">{totalRows.toLocaleString()}</span> rows
			</div>
		{:else}
			<div class="text-sm text-muted-foreground">No data</div>
		{/if}
	</div>

	<!-- Right side: Column visibility and export -->
	<div class="flex items-center gap-2 flex-shrink-0">
		<!-- Column visibility dropdown -->
		<div class="column-menu-container relative">
			<Button
				variant="outline"
				size="sm"
				onclick={() => (showColumnMenu = !showColumnMenu)}
			>
				<Eye class="w-4 h-4 mr-2" />
				Columns ({visibleColumns.length}/{allColumns.length})
				<ChevronDown class="w-4 h-4 ml-2" />
			</Button>

			{#if showColumnMenu}
				<div
					class="absolute right-0 mt-2 w-64 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
				>
					<div class="p-2">
						<div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
							Toggle Columns
						</div>
						{#each allColumns as column}
							{@const visible = isColumnVisible(column)}
							<button
								type="button"
								class={cn(
									'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors',
									visible ? 'text-foreground' : 'text-muted-foreground'
								)}
								onclick={() => handleToggleColumn(column)}
							>
								{#if visible}
									<Eye class="w-4 h-4 text-accent" />
								{:else}
									<EyeOff class="w-4 h-4" />
								{/if}
								<span class="truncate flex-1 text-left">{column}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Export button -->
		{#if onExport}
			<Button variant="outline" size="sm" onclick={onExport}>
				<Download class="w-4 h-4 mr-2" />
				Export CSV
			</Button>
		{/if}
	</div>
</div>
