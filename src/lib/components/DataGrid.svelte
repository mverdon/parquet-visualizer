<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createGrid, type GridOptions, type ColDef, ModuleRegistry } from '@ag-grid-community/core';
	import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
	import '@ag-grid-community/styles/ag-grid.css';
	import '@ag-grid-community/styles/ag-theme-quartz.css';

	// Register AG-Grid modules
	ModuleRegistry.registerModules([ClientSideRowModelModule]);

	interface Props {
		data: any[];
		columns?: string[];
		height?: string;
		onColumnVisibilityChange?: (visible: string[]) => void;
		onPaginationChange?: (currentPage: number, totalPages: number) => void;
	}

	let {
		data = $bindable([]),
		columns = $bindable([]),
		height = '600px',
		onColumnVisibilityChange,
		onPaginationChange
	}: Props = $props();

	let gridContainer: HTMLDivElement;
	let gridApi: any;
	let visibleColumns = $state<string[]>([]);

	// Generate column definitions from data
	function generateColumnDefs(cols: string[]): ColDef[] {
		return cols.map((col) => ({
			field: col,
			headerName: col,
			sortable: true,
			filter: true,
			resizable: true,
			flex: 1,
			minWidth: 120,
			valueFormatter: (params) => {
				if (params.value === null || params.value === undefined) {
					return '';
				}
				// Handle BigInt values
				if (typeof params.value === 'bigint') {
					if (params.value >= Number.MIN_SAFE_INTEGER && params.value <= Number.MAX_SAFE_INTEGER) {
						return String(Number(params.value));
					}
					return params.value.toString();
				}
				if (typeof params.value === 'object') {
					return JSON.stringify(params.value);
				}
				return String(params.value);
			}
		}));
	}

	// Create grid options
	const gridOptions: GridOptions = {
		defaultColDef: {
			sortable: true,
			filter: true,
			resizable: true
		},
		rowSelection: {
			mode: 'multiRow'
		},
		pagination: false, // Server-side pagination handled externally
		domLayout: 'normal',
		enableCellTextSelection: true,
		onGridReady: (params) => {
			gridApi = params.api;
			updateVisibleColumns();

			// If data already exists when grid becomes ready, update immediately
			if (data.length > 0 || columns.length > 0) {
				const plainColumns = $state.snapshot(columns);
				const cols = plainColumns.length > 0 ? plainColumns : (data.length > 0 ? Object.keys(data[0]) : []);
				// JSON serialize to strip methods - stringify can read proxies directly
				const plainData = JSON.parse(JSON.stringify(data));

				const colDefs = generateColumnDefs(cols);
				gridApi.setGridOption('columnDefs', colDefs);
				gridApi.setGridOption('rowData', plainData);

				setTimeout(() => {
					gridApi.getDisplayedRowCount();
				}, 100);

				gridApi.sizeColumnsToFit();
			}
		},
		onColumnVisible: () => {
			updateVisibleColumns();
		}
	};

	function updateVisibleColumns() {
		if (!gridApi) return;

		const allColumns = gridApi.getColumns();
		const visible = allColumns
			?.filter((col: any) => col.isVisible())
			.map((col: any) => col.getColDef().field)
			.filter(Boolean) || [];

		visibleColumns = visible;
		onColumnVisibilityChange?.(visible);
	}

	export function toggleColumn(columnName: string, visible: boolean) {
		if (!gridApi) return;
		gridApi.setColumnsVisible([columnName], visible);
	}

	export function getAllColumns(): string[] {
		return columns;
	}

	export function getVisibleColumns(): string[] {
		return visibleColumns;
	}

	export function exportToCsv() {
		if (!gridApi) return;
		gridApi.exportDataAsCsv();
	}

	onMount(() => {
		if (gridContainer) {
			// Set initial columns before creating grid (but not data - let $effect handle that)
			if (columns.length > 0) {
				const cols = columns;
				gridOptions.columnDefs = generateColumnDefs(cols);
			}
			createGrid(gridContainer, gridOptions);
		}
	});

	onDestroy(() => {
		gridApi?.destroy();
	});

	// Update grid when data or columns change
	$effect(() => {
		// Force evaluation of reactive state
		data.length; columns.length; gridApi;

		if (gridApi) {
			if (data.length > 0 || columns.length > 0) {
				// Convert $state proxies to plain arrays for AG-Grid
				const plainColumns = $state.snapshot(columns);
				const cols = plainColumns.length > 0 ? plainColumns : (data.length > 0 ? Object.keys(data[0]) : []);

				// JSON serialize to strip methods - stringify can read proxies directly
				const plainData = JSON.parse(JSON.stringify(data));
				plainData.length; // Force evaluation

				// Update column definitions first
				const colDefs = generateColumnDefs(cols);
				gridApi.setGridOption('columnDefs', colDefs);

				// Then update row data with plain array
				gridApi.setGridOption('rowData', plainData);

				// Check what the grid actually has (timing critical)
				setTimeout(() => {
					gridApi.getDisplayedRowCount();
				}, 100);

				// Force a refresh
				gridApi.sizeColumnsToFit();
			}
		}
	});
</script>

<div bind:this={gridContainer} class="ag-theme-quartz" style="height: {height}; width: 100%;"></div>

<style>
	:global(.ag-theme-quartz) {
		--ag-border-color: rgb(229 231 235);
		--ag-header-background-color: rgb(249 250 251);
		--ag-odd-row-background-color: rgb(255 255 255);
		--ag-row-hover-color: rgb(243 244 246);
		--ag-selected-row-background-color: rgb(239 246 255);
		--ag-font-family: inherit;
	}

	:global(.ag-header-cell-label) {
		font-weight: 600;
	}
</style>
