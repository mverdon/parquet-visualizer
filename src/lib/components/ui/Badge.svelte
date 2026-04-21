<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'default' | 'success' | 'destructive';
		children: Snippet;
	}

	let { variant = 'default', class: className, children, ...restProps }: Props = $props();

	const variants = {
		default: 'bg-muted text-foreground',
		success: 'bg-success/10 text-success border-success/20',
		destructive: 'bg-destructive/10 text-destructive border-destructive/20'
	};
</script>

<div
	class={cn(
		'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
		variants[variant],
		className
	)}
	{...restProps}
>
	{@render children()}
</div>
