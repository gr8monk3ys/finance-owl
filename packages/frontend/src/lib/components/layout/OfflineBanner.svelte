<script lang="ts">
  import { isOnline } from '$stores/online';
</script>

{#if !$isOnline}
  <div
    class="flex items-center justify-center gap-2 bg-yellow-600 px-4 py-2 text-center text-sm text-white"
    role="alert"
  >
    <svg
      class="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01"
      />
    </svg>
    <span>You're offline. Some features may be limited.</span>
  </div>
{/if}
