<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: boolean;
    iconLeft?: Snippet;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon = false,
    iconLeft,
    children,
    class: className = '',
    ...rest
  }: Props = $props();

  const variants: Record<string, string> = {
    primary:
      'bg-primary-600 text-white hover:bg-primary-500 focus:ring-primary-500/40 shadow-sm hover:shadow-md hover:shadow-primary-900/20 active:bg-primary-700',
    secondary:
      'bg-surface-700 text-surface-200 hover:bg-surface-600 focus:ring-surface-500/40 border border-surface-600 hover:border-surface-500 active:bg-surface-700/80',
    danger:
      'bg-red-600/90 text-white hover:bg-red-500 focus:ring-red-500/40 shadow-sm active:bg-red-700',
    ghost:
      'text-surface-300 hover:bg-surface-700/60 hover:text-white focus:ring-surface-500/40 active:bg-surface-700/80',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const iconSizes: Record<string, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const spinnerSizes: Record<string, string> = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };
</script>

<button
  class="btn-ripple inline-flex items-center justify-center rounded-lg font-medium
		transition-all duration-200 ease-out
		focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-surface-900
		disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
		disabled:shadow-none
		active:scale-[0.97]
		{variants[variant]}
		{icon ? iconSizes[size] : sizes[size]}
		{className}"
  disabled={loading || rest.disabled}
  {...rest}
>
  {#if loading}
    <svg class="{spinnerSizes[size]} animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  {:else if iconLeft}
    <span class="shrink-0 flex items-center">
      {@render iconLeft()}
    </span>
  {/if}
  <span class={loading ? 'opacity-70' : ''}>{@render children()}</span>
</button>
