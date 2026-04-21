<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import { formatFileSize, formatNumber } from '$lib/schema-utils';

	interface Props {
		fileName: string;
		fileSize: number;
		rowCount: number;
		columnCount: number;
	}

	let { fileName, fileSize, rowCount, columnCount }: Props = $props();
</script>

<Card class="h-full">
	<h3 class="text-base md:text-lg font-semibold mb-4">File Statistics</h3>
	<dl class="grid grid-cols-1 gap-4">
		<div>
			<dt class="text-xs md:text-sm text-muted-foreground mb-1">File Name</dt>
			<dd class="text-sm font-medium truncate">{fileName}</dd>
		</div>
		<div>
			<dt class="text-xs md:text-sm text-muted-foreground mb-1">File Size</dt>
			<dd class="text-sm font-medium">{formatFileSize(fileSize)}</dd>
		</div>
		<div>
			<dt class="text-xs md:text-sm text-muted-foreground mb-1">Total Rows</dt>
			<dd class="text-sm font-medium">{formatNumber(rowCount)}</dd>
		</div>
		<div>
			<dt class="text-xs md:text-sm text-muted-foreground mb-1">Total Columns</dt>
			<dd class="text-sm font-medium">{columnCount}</dd>
		</div>
	</dl>
</Card>
