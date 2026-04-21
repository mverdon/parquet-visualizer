<script lang="ts">
	import Card from './ui/Card.svelte';
	import Button from './ui/Button.svelte';
	import { AlertCircle, X } from 'lucide-svelte';

	interface Props {
		error: string | Error | null;
		title?: string;
		onDismiss?: () => void;
		showDetails?: boolean;
	}

	let { error, title = 'Error', onDismiss, showDetails = false }: Props = $props();

	let showFullError = $state(false);

	const errorMessage = $derived(() => {
		if (!error) return '';
		if (typeof error === 'string') return error;
		return error.message || 'An unknown error occurred';
	});

	const errorStack = $derived(() => {
		if (!error || typeof error === 'string') return null;
		return (error as Error).stack;
	});

	function getErrorSuggestion(message: string): string | null {
		const lowerMessage = message.toLowerCase();

		if (lowerMessage.includes('bigint') || lowerMessage.includes('cannot mix')) {
			return 'This data contains very large numbers. Try selecting specific columns or using CAST() to convert values.';
		}

		if (lowerMessage.includes('column') && lowerMessage.includes('not found')) {
			return 'Check that the column name is spelled correctly and exists in your table.';
		}

		if (lowerMessage.includes('syntax error')) {
			return 'There\'s a syntax error in your SQL query. Check for missing quotes, commas, or keywords.';
		}

		if (lowerMessage.includes('memory') || lowerMessage.includes('out of memory')) {
			return 'The operation ran out of memory. Try using LIMIT to reduce the result set size.';
		}

		if (lowerMessage.includes('table') && lowerMessage.includes('not found')) {
			return 'The table doesn\'t exist. Make sure you\'ve loaded the Parquet file first.';
		}

		return null;
	}

	const suggestion = $derived(getErrorSuggestion(errorMessage()));
</script>

{#if error}
	<Card class="border-destructive bg-destructive/5 p-4">
		<div class="flex items-start gap-3">
			<div class="flex-shrink-0 text-destructive">
				<AlertCircle class="w-5 h-5" />
			</div>
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<h4 class="font-semibold text-destructive">{title}</h4>
					{#if onDismiss}
						<button
							onclick={onDismiss}
							class="flex-shrink-0 text-destructive/60 hover:text-destructive"
							title="Dismiss"
						>
							<X class="w-4 h-4" />
						</button>
					{/if}
				</div>

				<p class="text-sm text-destructive/90 mt-1 break-words font-mono">
					{errorMessage()}
				</p>

				{#if suggestion}
					<div class="mt-3 p-2 bg-background/50 rounded border border-destructive/20">
						<p class="text-sm text-foreground">
							<span class="font-medium">💡 Suggestion:</span>
							{suggestion}
						</p>
					</div>
				{/if}

				{#if showDetails && errorStack()}
					<div class="mt-3">
						<Button
							size="sm"
							variant="ghost"
							onclick={() => showFullError = !showFullError}
							class="text-destructive hover:text-destructive"
						>
							{showFullError ? 'Hide' : 'Show'} Details
						</Button>

						{#if showFullError}
							<pre class="mt-2 p-2 bg-background/50 rounded border border-destructive/20 text-xs overflow-x-auto">
{errorStack()}
							</pre>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</Card>
{/if}
