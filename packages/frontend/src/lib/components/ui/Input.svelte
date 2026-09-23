<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  interface Props extends Omit<HTMLInputAttributes, 'prefix'> {
    label?: string;
    error?: string;
    hint?: string;
    value?: string | number | null;
    maxlength?: number;
    showCount?: boolean;
    prefix?: Snippet;
    suffix?: Snippet;
  }

  let {
    label,
    error,
    hint,
    id,
    value = $bindable(''),
    maxlength,
    showCount = false,
    prefix,
    suffix,
    class: className = '',
    ...rest
  }: Props = $props();

  // Callers that omit `id` still get a label bound to its input.
  const generatedId = $props.id();
  const inputId = $derived(id ?? generatedId);

  let focused = $state(false);

  const charCount = $derived(typeof value === 'string' ? value.length : 0);
  const hasPrefix = $derived(!!prefix);
  const hasSuffix = $derived(!!suffix);
  const isNearLimit = $derived(maxlength ? charCount >= maxlength * 0.9 : false);
  const isAtLimit = $derived(maxlength ? charCount >= maxlength : false);
</script>

<div class="group">
  {#if label}
    <label
      for={inputId}
      class="mb-1.5 block text-sm font-medium transition-colors duration-150
				{error ? 'text-red-400' : focused ? 'text-primary-400' : 'text-surface-300'}"
    >
      {label}
    </label>
  {/if}

  <div class="relative">
    {#if hasPrefix}
      <div
        class="pointer-events-none absolute left-0 top-0 flex h-full items-center pl-3 transition-colors duration-150
					{focused ? 'text-primary-400' : 'text-surface-400'}"
      >
        {@render prefix?.()}
      </div>
    {/if}

    <input
      id={inputId}
      bind:value
      {maxlength}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      class="block w-full rounded-lg border bg-surface-700/50 px-3 py-2.5 text-white
				placeholder:text-surface-500 transition duration-200
				focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0
				{hasPrefix ? 'pl-10' : ''}
				{hasSuffix ? 'pr-10' : ''}
				{error
        ? 'border-red-500/60 focus-visible:border-red-500 focus-visible:ring-red-500/20 shadow-sm shadow-red-500/5'
        : 'border-surface-600/80 hover:border-surface-500 focus-visible:border-primary-500 focus-visible:ring-primary-500/20'}
				{className}"
      {...rest}
    />

    {#if hasSuffix}
      <div
        class="pointer-events-none absolute right-0 top-0 flex h-full items-center pr-3 transition-colors duration-150
					{focused ? 'text-primary-400' : 'text-surface-400'}"
      >
        {@render suffix?.()}
      </div>
    {/if}

    <!-- Focus ring glow effect -->
    {#if focused && !error}
      <div
        class="absolute inset-0 -z-10 rounded-lg opacity-20 blur-sm bg-primary-500/10 transition-opacity duration-200"
      ></div>
    {/if}
  </div>

  <div class="mt-1.5 flex items-center justify-between min-h-[1.25rem]">
    <!-- Always mounted so a validation error is announced when it appears. -->
    <div aria-live="polite" class="min-w-0">
      {#if error}
        <p id="{inputId}-error" class="text-xs text-red-400 fade-in-up flex items-center gap-1">
          <svg aria-hidden="true" class="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          {error}
        </p>
      {:else if hint}
        <p id="{inputId}-hint" class="text-xs text-surface-500">{hint}</p>
      {/if}
    </div>

    {#if showCount && maxlength}
      <p
        class="text-xs tabular-nums transition-colors duration-150
					{isAtLimit ? 'text-red-400 font-medium' : isNearLimit ? 'text-accent-400' : 'text-surface-500'}"
      >
        {charCount}/{maxlength}
      </p>
    {/if}
  </div>
</div>
