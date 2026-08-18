<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    children: Snippet;
    footer?: Snippet;
  }

  let { open = $bindable(), onclose, title, size = 'md', children, footer }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onclose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] h-full',
  };

  $effect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Focus trap: focus the dialog on open
      const handleGlobalKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onclose();
        }
      };
      document.addEventListener('keydown', handleGlobalKeydown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleGlobalKeydown);
      };
    }
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4
			modal-backdrop-enter"
    style="background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label={title ?? 'Dialog'}
    onkeydown={handleKeydown}
    onclick={handleBackdropClick}
  >
    <div
      class="w-full rounded-t-2xl sm:rounded-xl bg-surface-800 border border-surface-700/50
				shadow-2xl shadow-black/40
				modal-slide-up sm:modal-content-enter
				{sizes[size]}"
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-surface-700/50 px-6 py-4">
          <h2 class="text-lg font-semibold text-white">{title}</h2>
          <button
            onclick={onclose}
            class="rounded-lg p-1.5 text-surface-400 transition-all duration-150
							hover:bg-surface-700 hover:text-white
							focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            aria-label="Close dialog"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              />
            </svg>
          </button>
        </div>
      {/if}
      <div class="p-6 {size === 'full' ? 'overflow-auto flex-1' : ''}">
        {@render children()}
      </div>
      {#if footer}
        <div
          class="border-t border-surface-700/50 px-6 py-4 bg-surface-850/30 rounded-b-xl flex items-center justify-end gap-3"
        >
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes modal-slide-up {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-slide-up {
    animation: modal-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
