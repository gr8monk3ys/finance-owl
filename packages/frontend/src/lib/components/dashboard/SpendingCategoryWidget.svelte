<script lang="ts">
  import { Card } from '$components/ui';

  interface CategoryBreakdown {
    categoryName: string;
    categoryColor: string;
    total: number;
  }

  interface Props {
    categoryBreakdown: CategoryBreakdown[];
  }

  let { categoryBreakdown }: Props = $props();

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  const labels = $derived(categoryBreakdown.map((c) => c.categoryName));
  const data = $derived(categoryBreakdown.map((c) => c.total));
  const colors = $derived(categoryBreakdown.map((c) => c.categoryColor));
</script>

<Card class="h-full">
  <h3 class="text-sm font-medium text-surface-400">Spending by Category</h3>

  {#if categoryBreakdown.length > 0}
    <div class="mt-3">
      {#await import('$lib/components/charts/DonutChart.svelte') then { default: DonutChart }}
        <DonutChart {labels} {data} {colors} height={140} />
      {/await}
    </div>
    <div class="mt-3 space-y-1.5">
      {#each categoryBreakdown.slice(0, 5) as cat}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" style="background-color: {cat.categoryColor}"></span>
            <span class="truncate text-xs text-surface-300">{cat.categoryName}</span>
          </div>
          <span class="text-xs font-medium text-surface-300">{fmt(cat.total)}</span>
        </div>
      {/each}
      {#if categoryBreakdown.length > 5}
        <p class="text-xs text-surface-400">+{categoryBreakdown.length - 5} more</p>
      {/if}
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center py-6 text-center">
      <svg
        class="h-8 w-8 text-surface-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z"
        />
      </svg>
      <p class="mt-2 text-xs text-surface-400">No spending data this month</p>
    </div>
  {/if}
</Card>
