<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { Spinner } from '$components/ui';

  const THRESHOLD = 60;

  let pulling = $state(false);
  let pullDistance = $state(0);
  let refreshing = $state(false);
  let startY = $state(0);

  function handleTouchStart(event: TouchEvent): void {
    if (refreshing) return;
    if (window.scrollY !== 0) return;

    startY = event.touches[0].clientY;
    pulling = true;
  }

  function handleTouchMove(event: TouchEvent): void {
    if (!pulling || refreshing) return;

    const currentY = event.touches[0].clientY;
    const distance = currentY - startY;

    if (distance < 0) {
      pulling = false;
      pullDistance = 0;
      return;
    }

    // Apply diminishing returns to the pull distance
    pullDistance = Math.min(distance * 0.4, THRESHOLD * 2);
  }

  async function handleTouchEnd(): Promise<void> {
    if (!pulling) return;

    if (pullDistance >= THRESHOLD) {
      refreshing = true;
      pullDistance = THRESHOLD;
      await invalidateAll();
      refreshing = false;
    }

    pulling = false;
    pullDistance = 0;
  }
</script>

<div
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="presentation"
>
  {#if pullDistance > 0 || refreshing}
    <div
      class="flex items-center justify-center overflow-hidden transition-[height] duration-150"
      style="height: {refreshing ? THRESHOLD : pullDistance}px"
    >
      {#if refreshing}
        <Spinner size="sm" />
      {:else}
        <svg
          class="h-5 w-5 text-surface-400 transition-transform"
          style="transform: rotate({(pullDistance / THRESHOLD) * 180}deg); opacity: {pullDistance /
            THRESHOLD}"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      {/if}
    </div>
  {/if}
</div>
