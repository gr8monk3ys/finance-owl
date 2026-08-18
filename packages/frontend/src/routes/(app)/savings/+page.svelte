<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showCreateModal = $state(false);
  let editingGoal = $state<any>(null);
  let contributingGoal = $state<any>(null);
  let viewingGoal = $state<any>(null);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showCreateModal = false;
      editingGoal = null;
      contributingGoal = null;
      viewingGoal = null;
    }
  });

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function fmtDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getProgressColor(progress: number): string {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-primary-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  }

  function getProgressTextColor(progress: number): string {
    if (progress >= 100) return 'text-green-400';
    if (progress >= 75) return 'text-primary-400';
    if (progress >= 50) return 'text-yellow-400';
    return 'text-orange-400';
  }

  function getDaysRemaining(deadline: string | null): string | null {
    if (!deadline) return null;
    const now = new Date();
    const target = new Date(deadline);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Past deadline';
    if (diff === 0) return 'Due today';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  }

  const goalColors = [
    '#6366f1',
    '#8b5cf6',
    '#ec4899',
    '#f43f5e',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
  ];

  const goalIcons = [
    'piggy-bank',
    'home',
    'car',
    'plane',
    'graduation',
    'heart',
    'star',
    'gift',
    'shield',
    'rocket',
  ];

  function getIconSvg(icon: string | null): string {
    switch (icon) {
      case 'home':
        return 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6';
      case 'car':
        return 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10';
      case 'plane':
        return 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8';
      case 'graduation':
        return 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z';
      case 'heart':
        return 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z';
      case 'star':
        return 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z';
      case 'gift':
        return 'M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 00-4 4v2h8zm0 0V6a4 4 0 014-4 4 4 0 014 4v2h-8zM5 8h14a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1z';
      case 'shield':
        return 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z';
      case 'rocket':
        return 'M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z';
      default:
        return 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z';
    }
  }
</script>

<svelte:head>
  <title>Savings Goals - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Savings Goals</h2>
    <Button onclick={() => (showCreateModal = true)}>New Goal</Button>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  <!-- Summary -->
  <div class="grid gap-4 sm:grid-cols-4">
    <Card>
      <p class="text-sm text-surface-400">Total Saved</p>
      <p class="mt-1 text-xl font-bold text-white">{fmt(data.summary.totalSaved)}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Active Goals</p>
      <p class="mt-1 text-xl font-bold text-white">{data.summary.activeGoals}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Completed</p>
      <p class="mt-1 text-xl font-bold text-green-400">{data.summary.completedGoals}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Savings Rate</p>
      <div class="mt-2">
        <div class="h-2 overflow-hidden rounded-full bg-surface-700">
          <div
            class="{getProgressColor(data.summary.savingsRate)} h-full rounded-full transition-all"
            style="width: {Math.min(data.summary.savingsRate, 100)}%"
          ></div>
        </div>
        <p class="mt-1 text-xs {getProgressTextColor(data.summary.savingsRate)}">
          {data.summary.savingsRate.toFixed(0)}% of target
        </p>
      </div>
    </Card>
  </div>

  <!-- Goals list -->
  {#if data.goals.length === 0}
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
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p class="mt-4 text-lg text-surface-300">No savings goals yet</p>
        <p class="mt-1 text-sm text-surface-500">
          Create a savings goal to start tracking your progress.
        </p>
      </div>
    </Card>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.goals as goal}
        <Card class="relative overflow-hidden">
          <!-- Color accent bar -->
          <div
            class="absolute left-0 top-0 h-1 w-full"
            style="background-color: {goal.color || '#6366f1'}"
          ></div>

          <div class="pt-2">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-lg"
                  style="background-color: {goal.color || '#6366f1'}20"
                >
                  <svg
                    class="h-5 w-5"
                    style="color: {goal.color || '#6366f1'}"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d={getIconSvg(goal.icon)}
                    />
                  </svg>
                </div>
                <div>
                  <p class="font-medium text-white">{goal.name}</p>
                  {#if goal.deadline}
                    {@const daysText = getDaysRemaining(goal.deadline)}
                    <p
                      class="text-xs {daysText === 'Past deadline'
                        ? 'text-red-400'
                        : 'text-surface-500'}"
                    >
                      {daysText}
                    </p>
                  {/if}
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
                  onclick={() => (contributingGoal = goal)}
                  title="Add contribution"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </button>
                <button
                  class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
                  onclick={() => (viewingGoal = goal)}
                  title="View details"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
                <button
                  class="rounded p-1 text-surface-400 hover:bg-surface-700 hover:text-white"
                  onclick={() => (editingGoal = goal)}
                  title="Edit goal"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Amount display -->
            <div class="mt-4">
              <div class="flex items-end justify-between">
                <span class="text-sm text-surface-300">
                  {fmt(goal.currentAmount)} of {fmt(goal.targetAmount)}
                </span>
                <span class="text-sm font-semibold {getProgressTextColor(goal.progress)}">
                  {goal.progress.toFixed(0)}%
                </span>
              </div>
              <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-700">
                <div
                  class="{getProgressColor(goal.progress)} h-full rounded-full transition-all"
                  style="width: {Math.min(goal.progress, 100)}%"
                ></div>
              </div>
              {#if goal.isCompleted}
                <p class="mt-2 text-xs font-medium text-green-400">Goal completed!</p>
              {:else}
                <p class="mt-1 text-right text-xs text-surface-500">
                  {fmt(goal.targetAmount - goal.currentAmount)} remaining
                </p>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Goal Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Create Savings Goal">
  <form
    method="POST"
    action="?/create"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="goalName" class="block text-sm font-medium text-surface-300">Goal Name</label>
      <input
        id="goalName"
        name="name"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Emergency Fund"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="goalTarget" class="block text-sm font-medium text-surface-300"
          >Target Amount</label
        >
        <input
          id="goalTarget"
          name="targetAmount"
          type="number"
          step="0.01"
          min="0.01"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="10000.00"
        />
      </div>
      <div>
        <label for="goalDeadline" class="block text-sm font-medium text-surface-300"
          >Deadline (optional)</label
        >
        <input
          id="goalDeadline"
          name="deadline"
          type="date"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div>
      <span class="block text-sm font-medium text-surface-300">Color</span>
      <div class="mt-2 flex flex-wrap gap-2">
        {#each goalColors as color, i}
          <label class="cursor-pointer">
            <input type="radio" name="color" value={color} checked={i === 0} class="peer sr-only" />
            <span
              class="block h-8 w-8 rounded-full border-2 border-transparent ring-offset-2 ring-offset-surface-800 peer-checked:border-white peer-checked:ring-2 peer-checked:ring-white/50"
              style="background-color: {color}"
            ></span>
          </label>
        {/each}
      </div>
    </div>

    <div>
      <label for="new-goal-icon" class="block text-sm font-medium text-surface-300">Icon</label>
      <select
        id="new-goal-icon"
        name="icon"
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="piggy-bank">Piggy Bank (default)</option>
        <option value="home">Home</option>
        <option value="car">Car</option>
        <option value="plane">Travel</option>
        <option value="graduation">Education</option>
        <option value="heart">Health</option>
        <option value="star">Star</option>
        <option value="gift">Gift</option>
        <option value="shield">Safety</option>
        <option value="rocket">Rocket</option>
      </select>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
        Cancel
      </Button>
      <Button type="submit">Create Goal</Button>
    </div>
  </form>
</Modal>

<!-- Edit Goal Modal -->
<Modal open={editingGoal !== null} onclose={() => (editingGoal = null)} title="Edit Savings Goal">
  {#if editingGoal}
    <form
      method="POST"
      action="?/update"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
        };
      }}
      class="space-y-4"
    >
      <input type="hidden" name="id" value={editingGoal.id} />

      <div>
        <label for="editName" class="block text-sm font-medium text-surface-300">Goal Name</label>
        <input
          id="editName"
          name="name"
          type="text"
          required
          value={editingGoal.name}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="editTarget" class="block text-sm font-medium text-surface-300"
            >Target Amount</label
          >
          <input
            id="editTarget"
            name="targetAmount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={editingGoal.targetAmount}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label for="editDeadline" class="block text-sm font-medium text-surface-300"
            >Deadline</label
          >
          <input
            id="editDeadline"
            name="deadline"
            type="date"
            value={editingGoal.deadline || ''}
            class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <span class="block text-sm font-medium text-surface-300">Color</span>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each goalColors as color}
            <label class="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                checked={editingGoal.color === color}
                class="peer sr-only"
              />
              <span
                class="block h-8 w-8 rounded-full border-2 border-transparent ring-offset-2 ring-offset-surface-800 peer-checked:border-white peer-checked:ring-2 peer-checked:ring-white/50"
                style="background-color: {color}"
              ></span>
            </label>
          {/each}
        </div>
      </div>

      <div>
        <label for="edit-goal-icon" class="block text-sm font-medium text-surface-300">Icon</label>
        <select
          id="edit-goal-icon"
          name="icon"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {#each goalIcons as icon}
            <option value={icon} selected={editingGoal.icon === icon}>{icon}</option>
          {/each}
        </select>
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="ghost" type="button" onclick={() => (editingGoal = null)}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>

    <form method="POST" action="?/delete" use:enhance class="mt-3 border-t border-surface-700 pt-3">
      <input type="hidden" name="id" value={editingGoal.id} />
      <Button type="submit" variant="danger" size="sm">Delete Goal</Button>
    </form>
  {/if}
</Modal>

<!-- Add Contribution Modal -->
<Modal
  open={contributingGoal !== null}
  onclose={() => (contributingGoal = null)}
  title="Add Contribution"
>
  {#if contributingGoal}
    <div class="mb-4 rounded-lg bg-surface-900 p-3">
      <p class="text-sm text-surface-400">Contributing to</p>
      <p class="font-medium text-white">{contributingGoal.name}</p>
      <p class="text-xs text-surface-500">
        {fmt(contributingGoal.currentAmount)} / {fmt(contributingGoal.targetAmount)}
        &mdash; {fmt(contributingGoal.targetAmount - contributingGoal.currentAmount)} remaining
      </p>
    </div>

    <form
      method="POST"
      action="?/contribute"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
        };
      }}
      class="space-y-4"
    >
      <input type="hidden" name="goalId" value={contributingGoal.id} />

      <div>
        <label for="contribAmount" class="block text-sm font-medium text-surface-300">Amount</label>
        <input
          id="contribAmount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="100.00"
        />
      </div>

      <div>
        <label for="contribDate" class="block text-sm font-medium text-surface-300"
          >Date (optional)</label
        >
        <input
          id="contribDate"
          name="date"
          type="date"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div>
        <label for="contribNote" class="block text-sm font-medium text-surface-300"
          >Note (optional)</label
        >
        <input
          id="contribNote"
          name="note"
          type="text"
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Monthly deposit"
        />
      </div>

      <div class="flex justify-end gap-3 pt-2">
        <Button variant="ghost" type="button" onclick={() => (contributingGoal = null)}>
          Cancel
        </Button>
        <Button type="submit">Add Contribution</Button>
      </div>
    </form>
  {/if}
</Modal>

<!-- View Goal Detail Modal (with contributions) -->
<Modal
  open={viewingGoal !== null}
  onclose={() => (viewingGoal = null)}
  title={viewingGoal?.name || 'Goal Details'}
>
  {#if viewingGoal}
    <div class="space-y-4">
      <!-- Progress overview -->
      <div class="rounded-lg bg-surface-900 p-4">
        <div class="flex items-end justify-between">
          <div>
            <p class="text-sm text-surface-400">Progress</p>
            <p class="text-2xl font-bold text-white">{fmt(viewingGoal.currentAmount)}</p>
            <p class="text-sm text-surface-500">of {fmt(viewingGoal.targetAmount)}</p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold {getProgressTextColor(viewingGoal.progress)}">
              {viewingGoal.progress.toFixed(1)}%
            </p>
            {#if viewingGoal.deadline}
              <p class="text-xs text-surface-500">{getDaysRemaining(viewingGoal.deadline)}</p>
            {/if}
          </div>
        </div>
        <div class="mt-3 h-3 overflow-hidden rounded-full bg-surface-700">
          <div
            class="{getProgressColor(viewingGoal.progress)} h-full rounded-full transition-all"
            style="width: {Math.min(viewingGoal.progress, 100)}%"
          ></div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="flex gap-2">
        <Button
          size="sm"
          onclick={() => {
            const g = viewingGoal;
            viewingGoal = null;
            contributingGoal = g;
          }}
        >
          Add Contribution
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onclick={() => {
            const g = viewingGoal;
            viewingGoal = null;
            editingGoal = g;
          }}
        >
          Edit Goal
        </Button>
      </div>

      <!-- Contribution history -->
      <div>
        <h3 class="text-sm font-medium text-surface-300">Contribution History</h3>
        {#if viewingGoal.contributions && viewingGoal.contributions.length > 0}
          <div class="mt-2 max-h-64 space-y-2 overflow-y-auto">
            {#each viewingGoal.contributions as contribution}
              <div class="flex items-center justify-between rounded-lg bg-surface-900 px-3 py-2">
                <div>
                  <p class="text-sm font-medium text-white">{fmt(contribution.amount)}</p>
                  <p class="text-xs text-surface-500">
                    {fmtDate(contribution.date)}
                    {#if contribution.note}
                      &mdash; {contribution.note}
                    {/if}
                  </p>
                </div>
                <form
                  method="POST"
                  action="?/removeContribution"
                  use:enhance={() => {
                    return async ({ update }) => {
                      await update();
                    };
                  }}
                >
                  <input type="hidden" name="goalId" value={viewingGoal.id} />
                  <input type="hidden" name="contributionId" value={contribution.id} />
                  <button
                    type="submit"
                    class="rounded p-1 text-surface-500 hover:bg-surface-700 hover:text-red-400"
                    title="Remove contribution"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            {/each}
          </div>
        {:else}
          <p class="mt-2 text-sm text-surface-500">No contributions yet.</p>
        {/if}
      </div>
    </div>
  {/if}
</Modal>
