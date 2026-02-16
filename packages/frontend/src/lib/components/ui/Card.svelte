<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		variant?: 'default' | 'elevated' | 'outlined' | 'glass';
		hover?: boolean;
		children: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let {
		class: className = '',
		padding = 'md',
		variant = 'default',
		hover = false,
		children,
		header,
		footer
	}: Props = $props();

	const paddings: Record<string, string> = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};

	const variants: Record<string, string> = {
		default: 'bg-surface-800 border border-surface-700/50',
		elevated: 'bg-surface-800 border border-surface-700/50 shadow-lg shadow-black/20',
		outlined: 'bg-transparent border border-surface-600 hover:border-surface-500',
		glass: 'glass'
	};
</script>

<div
	class="rounded-xl transition-all duration-200 ease-out
		{variants[variant]}
		{hover ? 'card-hover cursor-pointer hover:shadow-lg hover:shadow-black/20' : ''}
		{className}"
>
	{#if header}
		<div class="border-b border-surface-700/50 px-6 py-4">
			{@render header()}
		</div>
	{/if}

	<div class={paddings[padding]}>
		{@render children()}
	</div>

	{#if footer}
		<div class="border-t border-surface-700/50 px-6 py-4 bg-surface-850/30">
			{@render footer()}
		</div>
	{/if}
</div>
