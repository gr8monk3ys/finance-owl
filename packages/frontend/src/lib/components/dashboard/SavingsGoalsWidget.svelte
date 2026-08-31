<script lang="ts">
  import { Card } from '$components/ui';

  interface SavingsGoal {
    name: string;
    targetAmount: number;
    currentAmount: number;
    isCompleted: boolean | number;
    color?: string;
    icon?: string;
    deadline?: string;
  }

  interface Props {
    goals: SavingsGoal[];
  }

  let { goals }: Props = $props();

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  const activeGoals = $derived(goals.filter((g) => !g.isCompleted).slice(0, 4));

  function pct(goal: SavingsGoal): number {
    if (goal.targetAmount <= 0) return 100;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  }
</script>

<Card class="h-full">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-surface-400">Savings Goals</h3>
    <a href="/savings" class="text-xs text-primary-400 hover:text-primary-300">View all</a>
  </div>

  {#if activeGoals.length > 0}
    <div class="mt-3 space-y-3">
      {#each activeGoals as goal}
        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-surface-300">
              {goal.icon ? goal.icon + ' ' : ''}{goal.name}
            </span>
            <span class="text-xs text-surface-400">
              {pct(goal).toFixed(0)}%
            </span>
          </div>
          <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-700">
            <div
              class="h-full rounded-full transition-all duration-300"
              style="width: {pct(goal)}%; background-color: {goal.color || '#8b5cf6'}"
            ></div>
          </div>
          <p class="mt-0.5 text-xs text-surface-400">
            {fmt(goal.currentAmount)} of {fmt(goal.targetAmount)}
          </p>
        </div>
      {/each}
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
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
      <p class="mt-2 text-xs text-surface-400">
        <a href="/savings" class="text-primary-400 hover:text-primary-300">Create a savings goal</a>
      </p>
    </div>
  {/if}
</Card>
