<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
		class?: string;
	}

	let {
		title,
		description,
		icon,
		action,
		class: className = ''
	}: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center text-center px-6 py-12
		fade-in-up {className}"
>
	{#if icon}
		<div
			class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl
				bg-surface-700/50 text-surface-400
				border border-surface-600/30"
		>
			{@render icon()}
		</div>
	{:else}
		<!-- Default empty icon -->
		<div
			class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl
				bg-surface-700/50 text-surface-400
				border border-surface-600/30"
		>
			<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
			</svg>
		</div>
	{/if}

	<h3 class="text-lg font-semibold text-surface-200 mb-1.5">{title}</h3>

	{#if description}
		<p class="text-sm text-surface-400 max-w-sm leading-relaxed">{description}</p>
	{/if}

	{#if action}
		<div class="mt-6">
			{@render action()}
		</div>
	{/if}
</div>
