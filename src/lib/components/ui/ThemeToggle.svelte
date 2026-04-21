<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	import Button from './Button.svelte';

	type Theme = 'system' | 'light' | 'dark';

	let theme = $state<Theme>('system');
	let mounted = $state(false);

	// Apply theme to document
	function applyTheme(newTheme: Theme) {
		if (!mounted) return;

		const root = document.documentElement;
		const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		const effectiveTheme = newTheme === 'system' ? systemTheme : newTheme;

		if (effectiveTheme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		// Save to localStorage
		localStorage.setItem('theme', newTheme);
	}

	// Cycle through themes
	function toggleTheme() {
		const themes: Theme[] = ['system', 'light', 'dark'];
		const currentIndex = themes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		theme = themes[nextIndex];
		applyTheme(theme);
	}

	// Load theme from localStorage and apply
	onMount(() => {
		mounted = true;
		const savedTheme = localStorage.getItem('theme') as Theme | null;
		theme = savedTheme || 'system';
		applyTheme(theme);

		// Listen for system theme changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = () => {
			if (theme === 'system') {
				applyTheme('system');
			}
		};
		mediaQuery.addEventListener('change', handleChange);

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	});
</script>

<Button
	variant="ghost"
	size="sm"
	onclick={toggleTheme}
	aria-label="Toggle theme (currently {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'})"
>
	{#if theme === 'light'}
		<Sun class="h-4 w-4" />
		<span class="hidden sm:inline">Light</span>
	{:else if theme === 'dark'}
		<Moon class="h-4 w-4" />
		<span class="hidden sm:inline">Dark</span>
	{:else}
		<Monitor class="h-4 w-4" />
		<span class="hidden sm:inline">System</span>
	{/if}
</Button>
