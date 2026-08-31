<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    class?: string;
    children: Snippet;
  }

  let { content, position = 'top', class: className = '', children }: Props = $props();

  let visible = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function show() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      visible = true;
    }, 200);
  }

  function hide() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    visible = false;
  }

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-surface-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom:
      'bottom-full left-1/2 -translate-x-1/2 border-b-surface-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-surface-700 border-t-transparent border-b-transparent border-r-transparent',
    right:
      'right-full top-1/2 -translate-y-1/2 border-r-surface-700 border-t-transparent border-b-transparent border-l-transparent',
  };
</script>

<div
  class="relative inline-flex {className}"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  role="group"
>
  {@render children()}

  {#if visible && content}
    <div class="absolute z-50 pointer-events-none {positionClasses[position]}" role="tooltip">
      <div
        class="relative whitespace-nowrap rounded-lg bg-surface-700 border border-surface-600/50
					px-3 py-1.5 text-xs font-medium text-surface-100
					shadow-lg shadow-black/30
					tooltip-fade-in"
      >
        {content}
        <!-- Arrow -->
        <div class="absolute h-0 w-0 border-[5px] {arrowClasses[position]}"></div>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes tooltip-fade-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .tooltip-fade-in {
    animation: tooltip-fade-in 0.15s ease-out;
  }
</style>
