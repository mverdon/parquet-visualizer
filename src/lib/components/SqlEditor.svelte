<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		value?: string;
		height?: string;
		placeholder?: string;
		onValueChange?: (value: string) => void;
		onExecute?: () => void;
	}

	let {
		value = $bindable(''),
		height = '200px',
		placeholder = 'Enter your SQL query here...',
		onValueChange,
		onExecute
	}: Props = $props();

	let editorContainer: HTMLDivElement;
	let editor: any = null;
	let monaco: any = null;
	let isLoading = $state(true);
	let themeObserver: MutationObserver | null = null;

	// Function to get current theme
	function getCurrentTheme(): 'vs' | 'vs-dark' {
		return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs';
	}

	onMount(async () => {
		if (!browser) return;

		// Dynamically import Monaco Editor (browser-only)
		const [monacoEditor, editorWorkerModule] = await Promise.all([
			import('monaco-editor'),
			import('monaco-editor/esm/vs/editor/editor.worker?worker')
		]);

		monaco = monacoEditor;
		const editorWorker = editorWorkerModule.default;

		// Configure Monaco workers
		self.MonacoEnvironment = {
			getWorker() {
				return new editorWorker();
			}
		};

		// Create editor instance
		editor = monaco.editor.create(editorContainer, {
			value: value || placeholder,
			language: 'sql',
			theme: getCurrentTheme(),
			minimap: { enabled: false },
			lineNumbers: 'on',
			roundedSelection: false,
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			fontSize: 14,
			wordWrap: 'on',
			quickSuggestions: true,
			suggestOnTriggerCharacters: true
		});

		// Listen for theme changes
		themeObserver = new MutationObserver(() => {
			if (editor) {
				monaco.editor.setTheme(getCurrentTheme());
			}
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class']
		});

		// Listen for value changes
		editor.onDidChangeModelContent(() => {
			const newValue = editor?.getValue() || '';
			value = newValue;
			onValueChange?.(newValue);
		});

		// Listen for Ctrl+Enter to execute
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
			onExecute?.();
		});

		// Clear placeholder on focus
		editor.onDidFocusEditorText(() => {
			if (editor?.getValue() === placeholder) {
				editor?.setValue('');
			}
		});

		isLoading = false;
	});

	onDestroy(() => {
		themeObserver?.disconnect();
		editor?.dispose();
	});

	// Update editor when value changes externally
	$effect(() => {
		if (editor && value !== editor.getValue()) {
			editor.setValue(value);
		}
	});

	export function focus() {
		editor?.focus();
	}

	export function getValue(): string {
		return editor?.getValue() || '';
	}

	export function setValue(newValue: string) {
		editor?.setValue(newValue);
	}

	export function insertText(text: string) {
		const selection = editor?.getSelection();
		if (editor && selection) {
			editor.executeEdits('', [
				{
					range: selection,
					text: text,
					forceMoveMarkers: true
				}
			]);
		}
	}
</script>

<div class="relative border border-border rounded-md overflow-hidden" style="height: {height}; width: 100%;">
	{#if isLoading}
		<div class="absolute inset-0 bg-background flex items-center justify-center">
			<div class="flex flex-col items-center gap-3">
				<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
				<span class="text-sm text-muted-foreground">Loading editor...</span>
			</div>
		</div>
	{/if}
	<div bind:this={editorContainer} style="height: {height}; width: 100%;" class:opacity-0={isLoading}></div>
</div>

<style>
	:global(.monaco-editor .margin) {
		background-color: hsl(var(--muted)) !important;
	}
</style>
