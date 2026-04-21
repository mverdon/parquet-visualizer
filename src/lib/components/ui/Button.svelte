<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'default' | 'outline' | 'ghost' | 'destructive';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		children: Snippet;
	}

	let {
		variant = 'default',
		size = 'default',
		class: className,
		children,
		...restProps
	}: Props = $props();

	const variants = {
		default: 'bg-accent text-accent-foreground hover:bg-accent/90',
		outline: 'border border-border bg-background hover:bg-muted',
		ghost: 'hover:bg-muted hover:text-foreground',
		destructive: 'bg-destructive text-white hover:bg-destructive/90'
	};

	const sizes = {
		default: 'h-10 px-4 py-2',
		sm: 'h-9 px-3',
		lg: 'h-11 px-8',
		icon: 'h-10 w-10'
	};
</script>

<button
	class={cn(
		'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
		variants[variant],
		sizes[size],
		className
	)}
	{...restProps}
>
	{@render children()}
</button>
