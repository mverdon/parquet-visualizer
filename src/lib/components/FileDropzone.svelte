<script lang="ts">
	import { cn } from '$lib/utils';
	import { Upload, FileText, FolderOpen } from 'lucide-svelte';
	import Button from './ui/Button.svelte';

	interface Props {
		onFilesSelected: (files: File[]) => void;
		accept?: string;
		compact?: boolean;
		class?: string;
	}

	let { onFilesSelected, accept = '.parquet', compact = false, class: className }: Props = $props();

	let isDragging = $state(false);
	let fileInput: HTMLInputElement;
	let folderInput: HTMLInputElement;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const items = e.dataTransfer?.items;
		if (!items) return;

		const files: File[] = [];

		// Process all dropped items (files and folders)
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.kind === 'file') {
				const entry = item.webkitGetAsEntry();
				if (entry) {
					await traverseFileTree(entry, files);
				}
			}
		}

		const parquetFiles = files.filter(f => f.name.endsWith('.parquet'));
		if (parquetFiles.length > 0) {
			onFilesSelected(parquetFiles);
		}
	}

	// Recursively traverse directory tree
	async function traverseFileTree(entry: any, files: File[]): Promise<void> {
		if (entry.isFile) {
			return new Promise((resolve) => {
				entry.file((file: File) => {
					files.push(file);
					resolve();
				});
			});
		} else if (entry.isDirectory) {
			const dirReader = entry.createReader();
			return new Promise((resolve) => {
				dirReader.readEntries(async (entries: any[]) => {
					for (const entry of entries) {
						await traverseFileTree(entry, files);
					}
					resolve();
				});
			});
		}
	}

	function handleFileInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = Array.from(target.files || []);
		if (files.length > 0) {
			onFilesSelected(files);
		}
		// Reset input so same files can be selected again
		target.value = '';
	}

	function handleFolderInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = Array.from(target.files || []);
		const parquetFiles = files.filter(f => f.name.endsWith('.parquet'));
		if (parquetFiles.length > 0) {
			onFilesSelected(parquetFiles);
		}
		// Reset input so same folder can be selected again
		target.value = '';
	}

	function openFilePicker() {
		fileInput?.click();
	}

	function openFolderPicker() {
		folderInput?.click();
	}
</script>

<div class={cn('space-y-3', className)}>
	<div
		class={cn(
			'flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
			isDragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50',
			compact ? 'p-6' : 'p-12'
		)}
		role="region"
		aria-label="File drop zone"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
	>
		<Upload class={cn('text-muted-foreground mb-4', compact ? 'w-8 h-8' : 'w-12 h-12')} />
		<div class="text-center">
			<p class={cn('font-medium mb-1', compact ? 'text-base' : 'text-lg')}>
				Drop Parquet files or folders here
			</p>
			<p class="text-sm text-muted-foreground">
				{compact ? 'or use the buttons below' : 'Supports multiple files and folders • Use buttons below to browse'}
			</p>
		</div>
	</div>

	<div class="flex gap-2">
		<Button variant="outline" class="flex-1" onclick={openFilePicker}>
			<FileText class="w-4 h-4 mr-2" />
			{compact ? 'Add Files' : 'Browse Files'}
		</Button>
		<Button variant="outline" class="flex-1" onclick={openFolderPicker}>
			<FolderOpen class="w-4 h-4 mr-2" />
			{compact ? 'Add Folder' : 'Browse Folder'}
		</Button>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept={accept}
		multiple
		class="hidden"
		onchange={handleFileInput}
	/>

	<input
		bind:this={folderInput}
		type="file"
		webkitdirectory
		class="hidden"
		onchange={handleFolderInput}
	/>
</div>
