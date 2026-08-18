<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showGoalModal = $state(false);
  let calculating = $state(false);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showGoalModal = false;
      calculating = false;
    }
    if (form?.error) {
      calculating = false;
    }
  });

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  }

  function getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  }

  function getScoreTextColor(score: number): string {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function getProgressPercent(current: number, target: number): number {
    if (target <= 0) return 0;
    return Math.min((current / target) * 100, 100);
  }

  const categoryLabels: Record<string, string> = {
    savings: 'Savings',
    debt: 'Debt',
    spending: 'Spending',
    investment: 'Investment',
    emergency: 'Emergency Fund',
  };

  const subScores = $derived(
    data.score
      ? [
          { label: 'Savings', value: data.score.savingsScore, icon: 'piggy-bank' },
          { label: 'Debt', value: data.score.debtScore, icon: 'credit-card' },
          { label: 'Spending', value: data.score.spendingScore, icon: 'shopping-cart' },
          { label: 'Investment', value: data.score.investmentScore, icon: 'trending-up' },
          {
            label: 'Emergency Fund',
            value: data.score.emergencyFundScore,
            icon: 'shield',
          },
        ]
      : [],
  );

  // SVG gauge calculations
  const gaugeRadius = 80;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const overallScore = $derived(data.score?.overallScore ?? 0);
  const gaugeDashOffset = $derived(gaugeCircumference - (overallScore / 100) * gaugeCircumference);
</script>

<svelte:head>
  <title>Financial Health - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Financial Health</h2>
      <p class="mt-1 text-sm text-surface-400">Your composite financial wellness score</p>
    </div>
    <div class="flex gap-2">
      <Button onclick={() => (showGoalModal = true)} variant="secondary">Add Goal</Button>
      <form
        method="POST"
        action="?/calculate"
        use:enhance={() => {
          calculating = true;
          return async ({ update }) => {
            await update();
          };
        }}
      >
        <Button type="submit" loading={calculating}>Calculate Score</Button>
      </form>
    </div>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  {#if data.score}
    <!-- Score Gauge -->
    <Card>
      <div class="flex flex-col items-center py-6">
        <div class="relative h-48 w-48">
          <svg class="h-full w-full -rotate-90" viewBox="0 0 200 200">
            <!-- Background circle -->
            <circle
              cx="100"
              cy="100"
              r={gaugeRadius}
              fill="none"
              stroke="currentColor"
              stroke-width="12"
              class="text-surface-700"
            />
            <!-- Score arc -->
            <circle
              cx="100"
              cy="100"
              r={gaugeRadius}
              fill="none"
              stroke={getScoreColor(overallScore)}
              stroke-width="12"
              stroke-linecap="round"
              stroke-dasharray={gaugeCircumference}
              stroke-dashoffset={gaugeDashOffset}
              class="transition-all duration-1000"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-4xl font-bold text-white">{overallScore}</span>
            <span class="text-sm {getScoreTextColor(overallScore)}">
              {getScoreLabel(overallScore)}
            </span>
          </div>
        </div>
        <p class="mt-3 text-xs text-surface-500">
          Last calculated: {new Date(data.score.calculatedAt).toLocaleDateString()}
        </p>
      </div>
    </Card>

    <!-- Sub-score breakdown -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {#each subScores as sub}
        <Card>
          <div class="text-center">
            <p class="text-sm text-surface-400">{sub.label}</p>
            <p class="mt-1 text-3xl font-bold {getScoreTextColor(sub.value)}">
              {sub.value}
            </p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-700">
              <div
                class="h-full rounded-full transition-all"
                style="width: {sub.value}%; background-color: {getScoreColor(sub.value)}"
              ></div>
            </div>
          </div>
        </Card>
      {/each}
    </div>

    <!-- Score History -->
    {#if data.history.length > 1}
      <Card>
        <h3 class="text-lg font-semibold text-white">Score Trend</h3>
        <div class="mt-4 flex items-end gap-1" style="height: 120px;">
          {#each data.history.slice(0, 20).reverse() as entry}
            {@const barHeight = Math.max((entry.overallScore / 100) * 100, 4)}
            <div class="flex flex-1 flex-col items-center gap-1">
              <span class="text-xs text-surface-500">{entry.overallScore}</span>
              <div
                class="w-full rounded-t transition-all"
                style="height: {barHeight}%; background-color: {getScoreColor(entry.overallScore)}"
              ></div>
            </div>
          {/each}
        </div>
        <p class="mt-2 text-center text-xs text-surface-500">Recent calculations</p>
      </Card>
    {/if}
  {:else}
    <!-- Empty state -->
    <Card>
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <svg
          class="h-16 w-16 text-surface-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <p class="mt-4 text-lg text-surface-300">No health score yet</p>
        <p class="mt-1 text-sm text-surface-500">
          Calculate your first financial health score to see how you are doing.
        </p>
      </div>
    </Card>
  {/if}

  <!-- Goals -->
  <div>
    <h3 class="mb-3 text-lg font-semibold text-white">Financial Goals</h3>
    {#if data.goals.length === 0}
      <Card>
        <p class="py-6 text-center text-sm text-surface-500">
          No goals set yet. Add a goal to track your progress.
        </p>
      </Card>
    {:else}
      <div class="space-y-3">
        {#each data.goals as goal}
          {@const progress = getProgressPercent(goal.currentValue, goal.targetValue)}
          <Card>
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium
											{goal.isAchieved ? 'bg-green-900/50 text-green-400' : 'bg-surface-700 text-surface-300'}"
                  >
                    {categoryLabels[goal.category] ?? goal.category}
                  </span>
                  {#if goal.isAchieved}
                    <span class="text-xs text-green-400">Achieved</span>
                  {/if}
                </div>
                {#if goal.description}
                  <p class="mt-1 text-sm text-surface-300">{goal.description}</p>
                {/if}
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-white">
                  {fmt(goal.currentValue)} / {fmt(goal.targetValue)}
                </p>
              </div>
            </div>
            <div class="mt-3">
              <div class="h-2 overflow-hidden rounded-full bg-surface-700">
                <div
                  class="h-full rounded-full transition-all {goal.isAchieved
                    ? 'bg-green-500'
                    : 'bg-primary-500'}"
                  style="width: {progress}%"
                ></div>
              </div>
              <p class="mt-1 text-right text-xs text-surface-500">
                {progress.toFixed(0)}%
              </p>
            </div>

            {#if !goal.isAchieved}
              <form
                method="POST"
                action="?/updateGoal"
                use:enhance
                class="mt-3 flex items-center gap-2 border-t border-surface-700 pt-3"
              >
                <input type="hidden" name="id" value={goal.id} />
                <input
                  name="currentValue"
                  type="number"
                  step="0.01"
                  placeholder="Update progress"
                  required
                  class="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <Button type="submit" size="sm">Update</Button>
              </form>
            {/if}
          </Card>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Create Goal Modal -->
<Modal open={showGoalModal} onclose={() => (showGoalModal = false)} title="Add Financial Goal">
  <form
    method="POST"
    action="?/createGoal"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="goalCategory" class="block text-sm font-medium text-surface-300">
        Category
      </label>
      <select
        id="goalCategory"
        name="category"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="savings">Savings</option>
        <option value="debt">Debt</option>
        <option value="spending">Spending</option>
        <option value="investment">Investment</option>
        <option value="emergency">Emergency Fund</option>
      </select>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="goalTarget" class="block text-sm font-medium text-surface-300">
          Target Value
        </label>
        <input
          id="goalTarget"
          name="targetValue"
          type="number"
          step="0.01"
          min="0"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="10000.00"
        />
      </div>
      <div>
        <label for="goalCurrent" class="block text-sm font-medium text-surface-300">
          Current Value
        </label>
        <input
          id="goalCurrent"
          name="currentValue"
          type="number"
          step="0.01"
          min="0"
          value="0"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div>
      <label for="goalDescription" class="block text-sm font-medium text-surface-300">
        Description (optional)
      </label>
      <input
        id="goalDescription"
        name="description"
        type="text"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Build 6 months emergency fund"
      />
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showGoalModal = false)}>Cancel</Button>
      <Button type="submit">Create Goal</Button>
    </div>
  </form>
</Modal>
