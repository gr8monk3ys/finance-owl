<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
		size?: 'sm' | 'md';
		dot?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'neutral',
		size = 'md',
		dot = false,
		class: className = '',
		children
	}: Props = $props();

	const variants: Record<string, string> = {
		success: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
		warning: 'bg-accent-500/15 text-accent-400 border-accent-500/20',
		error: 'bg-red-500/15 text-red-400 border-red-500/20',
		info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
		neutral: 'bg-surface-600/30 text-surface-300 border-surface-500/20'
	};

	const dotColors: Record<string, string> = {
		success: 'bg-primary-400',
		warning: 'bg-accent-400',
		error: 'bg-red-400',
		info: 'bg-blue-400',
		neutral: 'bg-surface-400'
	};

	const sizes: Record<string, string> = {
		sm: 'px-1.5 py-0.5 text-[10px] gap-1',
		md: 'px-2.5 py-1 text-xs gap-1.5'
	};

	const dotSizes: Record<string, string> = {
		sm: 'h-1 w-1',
		md: 'h-1.5 w-1.5'
	};
</script>

<span
	class="inline-flex items-center font-medium rounded-full border transition-colors duration-150
		{variants[variant]}
		{sizes[size]}
		{className}"
>
	{#if dot}
		<span class="shrink-0 rounded-full {dotColors[variant]} {dotSizes[size]}"></span>
	{/if}
	{@render children()}
</span>
