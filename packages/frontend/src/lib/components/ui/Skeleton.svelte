<script lang="ts">
	interface Props {
		variant?: 'text' | 'circular' | 'rectangular';
		width?: string;
		height?: string;
		class?: string;
		lines?: number;
	}

	let {
		variant = 'text',
		width,
		height,
		class: className = '',
		lines = 1
	}: Props = $props();

	const variantClasses: Record<string, string> = {
		text: 'rounded-md',
		circular: 'rounded-full',
		rectangular: 'rounded-lg'
	};

	const defaultDimensions: Record<string, { width: string; height: string }> = {
		text: { width: '100%', height: '0.875rem' },
		circular: { width: '2.5rem', height: '2.5rem' },
		rectangular: { width: '100%', height: '8rem' }
	};

	const resolvedWidth = $derived(width ?? defaultDimensions[variant].width);
	const resolvedHeight = $derived(height ?? defaultDimensions[variant].height);
</script>

{#if variant === 'text' && lines > 1}
	<div class="flex flex-col gap-2 {className}" role="status" aria-label="Loading">
		{#each Array(lines) as _, i}
			<div
				class="skeleton-pulse {variantClasses[variant]}"
				style="width: {i === lines - 1 ? '75%' : resolvedWidth}; height: {resolvedHeight};"
			></div>
		{/each}
		<span class="sr-only">Loading...</span>
	</div>
{:else}
	<div
		class="skeleton-pulse {variantClasses[variant]} {className}"
		style="width: {resolvedWidth}; height: {resolvedHeight};"
		role="status"
		aria-label="Loading"
	>
		<span class="sr-only">Loading...</span>
	</div>
{/if}
