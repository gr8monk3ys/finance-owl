<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { ActionData, PageData } from './$types';
  import { Button, Card, Modal } from '$components/ui';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let showProfileModal = $state(false);
  let saving = $state(false);
  let simulating = $state(false);
  let activeScenario = $state<string | null>(null);
  let scenarioAmount = $state(5000);
  let scenarioCreditLimit = $state(5000);
  let scenarioCardAge = $state(24);
  let scenarioMonths = $state(6);

  $effect(() => {
    if (form?.profileSaved) {
      showProfileModal = false;
      invalidateAll();
    }
    if (form?.simulationResult) {
      invalidateAll();
    }
  });

  function getScoreColor(score: number): string {
    if (score >= 740) return 'text-emerald-400';
    if (score >= 670) return 'text-green-400';
    if (score >= 580) return 'text-yellow-400';
    return 'text-red-400';
  }

  function getScoreLabel(score: number): string {
    if (score >= 740) return 'Excellent';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  }

  function getScoreBgColor(score: number): string {
    if (score >= 740) return 'bg-emerald-500';
    if (score >= 670) return 'bg-green-500';
    if (score >= 580) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function getImpactColor(impact: number): string {
    if (impact > 0) return 'text-green-400';
    if (impact < 0) return 'text-red-400';
    return 'text-surface-400';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getScenarioLabel(type: string): string {
    const labels: Record<string, string> = {
      pay_debt: 'Pay Down Debt',
      open_card: 'Open New Card',
      close_card: 'Close a Card',
      hard_inquiry: 'Hard Inquiry',
      on_time_payments: 'On-Time Payments',
      increase_limit: 'Increase Limit',
    };
    return labels[type] ?? type;
  }

  function getScenarioIcon(type: string): string {
    const icons: Record<string, string> = {
      pay_debt:
        'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
      open_card:
        'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
      close_card: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      hard_inquiry: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
      on_time_payments: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      increase_limit:
        'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
    };
    return icons[type] ?? '';
  }

  function getParametersJson(): string {
    if (!activeScenario) return '{}';

    switch (activeScenario) {
      case 'pay_debt':
        return JSON.stringify({ amount: scenarioAmount });
      case 'open_card':
        return JSON.stringify({ creditLimit: scenarioCreditLimit });
      case 'close_card':
        return JSON.stringify({ creditLimit: scenarioCreditLimit, cardAgeMonths: scenarioCardAge });
      case 'hard_inquiry':
        return '{}';
      case 'on_time_payments':
        return JSON.stringify({ months: scenarioMonths });
      case 'increase_limit':
        return JSON.stringify({ amount: scenarioAmount });
      default:
        return '{}';
    }
  }

  const scenarios = [
    'pay_debt',
    'open_card',
    'close_card',
    'hard_inquiry',
    'on_time_payments',
    'increase_limit',
  ];

  const scorePercent = $derived(data.profile ? ((data.profile.currentScore - 300) / 550) * 100 : 0);
</script>

<svelte:head>
  <title>Credit Score Simulator - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <a
        href="/credit"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition hover:bg-surface-700 hover:text-white"
        aria-label="Back to credit"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
      <h1 class="text-2xl font-bold text-white">Credit Score Simulator</h1>
    </div>
    <Button onclick={() => (showProfileModal = true)}>
      {data.profile ? 'Edit Profile' : 'Set Up Profile'}
    </Button>
  </div>

  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
      {form.error}
    </div>
  {/if}

  {#if !data.profile}
    <!-- No Profile State -->
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
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        <p class="mt-4 text-lg text-surface-300">No credit profile yet</p>
        <p class="mt-1 text-sm text-surface-500">
          Create your credit profile to start running simulations.
        </p>
        <div class="mt-6">
          <Button onclick={() => (showProfileModal = true)}>Create Profile</Button>
        </div>
      </div>
    </Card>
  {:else}
    <!-- Credit Score Display -->
    <Card>
      <div class="flex flex-col items-center py-6">
        <p class="text-sm text-surface-400">Current Credit Score</p>
        <p class="mt-2 text-6xl font-bold {getScoreColor(data.profile.currentScore)}">
          {data.profile.currentScore}
        </p>
        <p class="mt-2 text-sm font-medium {getScoreColor(data.profile.currentScore)}">
          {getScoreLabel(data.profile.currentScore)}
        </p>

        <!-- Score Bar -->
        <div class="mt-4 w-full max-w-md">
          <div class="h-3 overflow-hidden rounded-full bg-surface-700">
            <div
              class="{getScoreBgColor(
                data.profile.currentScore,
              )} h-full rounded-full transition-all"
              style="width: {scorePercent}%"
            ></div>
          </div>
          <div class="mt-1 flex justify-between text-xs text-surface-500">
            <span>300</span>
            <span>580</span>
            <span>670</span>
            <span>740</span>
            <span>850</span>
          </div>
        </div>

        <!-- Profile Summary -->
        <div class="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg bg-surface-800 p-3 text-center">
            <p class="text-xs text-surface-400">Utilization</p>
            <p class="mt-1 text-sm font-semibold text-white">
              {(data.profile.creditUtilization * 100).toFixed(0)}%
            </p>
          </div>
          <div class="rounded-lg bg-surface-800 p-3 text-center">
            <p class="text-xs text-surface-400">Payment History</p>
            <p class="mt-1 text-sm font-semibold text-white">
              {(data.profile.paymentHistory * 100).toFixed(0)}%
            </p>
          </div>
          <div class="rounded-lg bg-surface-800 p-3 text-center">
            <p class="text-xs text-surface-400">Total Debt</p>
            <p class="mt-1 text-sm font-semibold text-white">
              ${data.profile.totalDebt.toLocaleString()}
            </p>
          </div>
          <div class="rounded-lg bg-surface-800 p-3 text-center">
            <p class="text-xs text-surface-400">Inquiries</p>
            <p class="mt-1 text-sm font-semibold text-white">
              {data.profile.hardInquiries}
            </p>
          </div>
        </div>
      </div>
    </Card>

    <!-- Simulation Result -->
    {#if form?.simulationResult}
      <Card>
        <div class="flex items-center gap-4">
          <div
            class="flex h-12 w-12 items-center justify-center rounded-full {form.simulationResult
              .estimatedImpact >= 0
              ? 'bg-green-900/50'
              : 'bg-red-900/50'}"
          >
            <span class="text-lg font-bold {getImpactColor(form.simulationResult.estimatedImpact)}">
              {form.simulationResult.estimatedImpact > 0 ? '+' : ''}{form.simulationResult
                .estimatedImpact}
            </span>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-white">
              {getScenarioLabel(form.simulationResult.scenarioType)}
            </p>
            <p class="mt-1 text-xs text-surface-400">
              Estimated new score:
              <span class="font-semibold {getScoreColor(form.simulationResult.estimatedNewScore)}">
                {form.simulationResult.estimatedNewScore}
              </span>
            </p>
          </div>
        </div>
        <p class="mt-3 text-sm text-surface-300">{form.simulationResult.explanation}</p>
      </Card>
    {/if}

    <!-- Scenario Cards -->
    <div>
      <h2 class="mb-3 text-lg font-semibold text-white">What-If Scenarios</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each scenarios as scenario}
          <button
            class="rounded-lg border border-surface-700 bg-surface-800 p-4 text-left transition-colors hover:border-primary-600 hover:bg-surface-700 {activeScenario ===
            scenario
              ? 'border-primary-500 ring-1 ring-primary-500'
              : ''}"
            onclick={() => {
              activeScenario = activeScenario === scenario ? null : scenario;
            }}
          >
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-700">
                <svg
                  class="h-5 w-5 text-primary-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d={getScenarioIcon(scenario)}
                  />
                </svg>
              </div>
              <span class="text-sm font-medium text-white">{getScenarioLabel(scenario)}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Active Scenario Form -->
    {#if activeScenario}
      <Card>
        <form
          method="POST"
          action="?/simulate"
          use:enhance={() => {
            simulating = true;
            return async ({ update }) => {
              simulating = false;
              await update();
            };
          }}
          class="space-y-4"
        >
          <h3 class="text-lg font-semibold text-white">
            {getScenarioLabel(activeScenario)}
          </h3>

          <input type="hidden" name="scenarioType" value={activeScenario} />
          <input type="hidden" name="parameters" value={getParametersJson()} />

          {#if activeScenario === 'pay_debt'}
            <div>
              <label for="payAmount" class="block text-sm font-medium text-surface-300">
                Payment Amount ($)
              </label>
              <input
                id="payAmount"
                type="number"
                min="100"
                step="100"
                bind:value={scenarioAmount}
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          {:else if activeScenario === 'open_card'}
            <div>
              <label for="newCardLimit" class="block text-sm font-medium text-surface-300">
                New Card Credit Limit ($)
              </label>
              <input
                id="newCardLimit"
                type="number"
                min="500"
                step="500"
                bind:value={scenarioCreditLimit}
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          {:else if activeScenario === 'close_card'}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="closeCardLimit" class="block text-sm font-medium text-surface-300">
                  Card Limit ($)
                </label>
                <input
                  id="closeCardLimit"
                  type="number"
                  min="500"
                  step="500"
                  bind:value={scenarioCreditLimit}
                  class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label for="closeCardAge" class="block text-sm font-medium text-surface-300">
                  Card Age (months)
                </label>
                <input
                  id="closeCardAge"
                  type="number"
                  min="1"
                  bind:value={scenarioCardAge}
                  class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          {:else if activeScenario === 'hard_inquiry'}
            <p class="text-sm text-surface-400">
              Simulate the impact of a single hard credit inquiry on your score.
            </p>
          {:else if activeScenario === 'on_time_payments'}
            <div>
              <label for="paymentMonths" class="block text-sm font-medium text-surface-300">
                Number of Months
              </label>
              <input
                id="paymentMonths"
                type="number"
                min="6"
                max="36"
                step="6"
                bind:value={scenarioMonths}
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          {:else if activeScenario === 'increase_limit'}
            <div>
              <label for="increaseAmount" class="block text-sm font-medium text-surface-300">
                Credit Limit Increase ($)
              </label>
              <input
                id="increaseAmount"
                type="number"
                min="500"
                step="500"
                bind:value={scenarioAmount}
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          {/if}

          <div class="flex gap-3 pt-2">
            <Button type="submit" loading={simulating}>Run Simulation</Button>
            <Button variant="ghost" type="button" onclick={() => (activeScenario = null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    {/if}

    <!-- Simulation History -->
    {#if data.simulations.length > 0}
      <Card padding="none">
        <div class="p-6">
          <h2 class="text-lg font-semibold text-white">Simulation History</h2>
          <p class="mt-1 text-sm text-surface-400">Your past what-if scenario results.</p>
        </div>

        <div class="overflow-hidden border-t border-surface-700">
          <table class="w-full">
            <thead>
              <tr class="border-b border-surface-700 bg-surface-800">
                <th
                  class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400"
                >
                  Scenario
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-400"
                >
                  Impact
                </th>
                <th
                  class="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-400 sm:table-cell"
                >
                  New Score
                </th>
                <th
                  class="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-400 sm:table-cell"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-700">
              {#each data.simulations as sim}
                <tr class="transition-colors hover:bg-surface-800/50">
                  <td class="px-4 py-3">
                    <span class="text-sm text-white">{getScenarioLabel(sim.scenarioType)}</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="text-sm font-semibold {getImpactColor(sim.estimatedImpact)}">
                      {sim.estimatedImpact > 0 ? '+' : ''}{sim.estimatedImpact}
                    </span>
                  </td>
                  <td class="hidden px-4 py-3 text-right sm:table-cell">
                    <span class="text-sm {getScoreColor(sim.estimatedNewScore)}">
                      {sim.estimatedNewScore}
                    </span>
                  </td>
                  <td class="hidden px-4 py-3 text-right text-xs text-surface-500 sm:table-cell">
                    {formatDate(sim.createdAt)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    {/if}
  {/if}
</div>

<!-- Profile Modal -->
<Modal
  open={showProfileModal}
  onclose={() => (showProfileModal = false)}
  title={data.profile ? 'Edit Credit Profile' : 'Create Credit Profile'}
>
  <form
    method="POST"
    action="?/saveProfile"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        saving = false;
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="currentScore" class="block text-sm font-medium text-surface-300">
        Current Credit Score
      </label>
      <input
        id="currentScore"
        name="currentScore"
        type="number"
        min="300"
        max="850"
        required
        value={data.profile?.currentScore ?? 700}
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="paymentHistory" class="block text-sm font-medium text-surface-300">
          Payment History (0-1)
        </label>
        <input
          id="paymentHistory"
          name="paymentHistory"
          type="number"
          min="0"
          max="1"
          step="0.01"
          required
          value={data.profile?.paymentHistory ?? 0.95}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label for="creditUtilization" class="block text-sm font-medium text-surface-300">
          Credit Utilization (0-1)
        </label>
        <input
          id="creditUtilization"
          name="creditUtilization"
          type="number"
          min="0"
          max="1"
          step="0.01"
          required
          value={data.profile?.creditUtilization ?? 0.3}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="accountAge" class="block text-sm font-medium text-surface-300">
          Account Age (months)
        </label>
        <input
          id="accountAge"
          name="accountAge"
          type="number"
          min="0"
          required
          value={data.profile?.accountAge ?? 48}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label for="totalAccounts" class="block text-sm font-medium text-surface-300">
          Total Accounts
        </label>
        <input
          id="totalAccounts"
          name="totalAccounts"
          type="number"
          min="0"
          required
          value={data.profile?.totalAccounts ?? 5}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="hardInquiries" class="block text-sm font-medium text-surface-300">
          Hard Inquiries
        </label>
        <input
          id="hardInquiries"
          name="hardInquiries"
          type="number"
          min="0"
          required
          value={data.profile?.hardInquiries ?? 1}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label for="derogatoryMarks" class="block text-sm font-medium text-surface-300">
          Derogatory Marks
        </label>
        <input
          id="derogatoryMarks"
          name="derogatoryMarks"
          type="number"
          min="0"
          required
          value={data.profile?.derogatoryMarks ?? 0}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="totalDebt" class="block text-sm font-medium text-surface-300">
          Total Debt ($)
        </label>
        <input
          id="totalDebt"
          name="totalDebt"
          type="number"
          min="0"
          step="100"
          required
          value={data.profile?.totalDebt ?? 5000}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div>
        <label for="availableCredit" class="block text-sm font-medium text-surface-300">
          Available Credit ($)
        </label>
        <input
          id="availableCredit"
          name="availableCredit"
          type="number"
          min="0"
          step="100"
          required
          value={data.profile?.availableCredit ?? 15000}
          class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showProfileModal = false)}>
        Cancel
      </Button>
      <Button type="submit" loading={saving}>
        {data.profile ? 'Update Profile' : 'Create Profile'}
      </Button>
    </div>
  </form>
</Modal>
