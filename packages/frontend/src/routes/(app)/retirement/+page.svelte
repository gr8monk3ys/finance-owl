<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button } from '$components/ui';
  import { LineChart, BarChart } from '$components/charts';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let profileOpen = $state(true);
  let scenariosOpen = $state(false);
  let feeAnalyzerOpen = $state(false);
  let loading = $state(false);

  // Scenario management
  let scenarios = $state<
    Array<{
      label: string;
      retirementAge?: number;
      monthlyContribution?: number;
    }>
  >([]);
  let scenarioResults = $state<any[] | null>(null);
  let feeAnalysis = $state<any | null>(null);

  $effect(() => {
    if (form?.success) {
      loading = false;
      invalidateAll();
    }
    if (form?.feeAnalysis) {
      feeAnalysis = form.feeAnalysis;
      loading = false;
    }
    if (form?.scenarioResults) {
      scenarioResults = form.scenarioResults;
      loading = false;
    }
  });

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function fmtPct(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function getScoreLabel(score: number): string {
    if (score >= 80) return 'On Track';
    if (score >= 60) return 'Needs Attention';
    if (score >= 40) return 'At Risk';
    return 'Behind';
  }

  function getSuccessColor(rate: number): string {
    if (rate >= 80) return 'text-green-400';
    if (rate >= 60) return 'text-yellow-400';
    return 'text-red-400';
  }

  // Projection chart data
  const projectionLabels = $derived(
    data.projection?.yearByYear?.map((y: any) => `Age ${y.age}`) ?? [],
  );

  const projectionDatasets = $derived(
    data.projection
      ? [
          {
            label: '90th Percentile',
            data: data.projection.yearByYear.map((y: any) => y.balanceHigh),
            borderColor: '#22c55e',
            backgroundColor: '#22c55e15',
            fill: true,
          },
          {
            label: 'Median',
            data: data.projection.yearByYear.map((y: any) => y.balanceMedian),
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f620',
            fill: true,
          },
          {
            label: '10th Percentile',
            data: data.projection.yearByYear.map((y: any) => y.balanceLow),
            borderColor: '#f97316',
            backgroundColor: '#f9731615',
            fill: true,
          },
        ]
      : [],
  );

  // Income sources at retirement
  const incomeLabels = $derived(['Savings Withdrawal', 'Social Security', 'Pension']);

  const incomeDatasets = $derived(
    data.projection
      ? [
          {
            label: 'Monthly Income',
            data: [
              (data.projection.projectedBalance.median * 0.04) / 12,
              data.profile.socialSecurityEstimate,
              data.profile.pensionAmount,
            ],
            backgroundColor: '#3b82f6',
          },
        ]
      : [],
  );

  function addScenario() {
    scenarios = [
      ...scenarios,
      {
        label: `Scenario ${scenarios.length + 1}`,
        retirementAge: data.profile.retirementAge,
        monthlyContribution: data.profile.monthlyContribution,
      },
    ];
  }

  function removeScenario(index: number) {
    scenarios = scenarios.filter((_, i) => i !== index);
    scenarioResults = null;
  }
</script>

<svelte:head>
  <title>Retirement Planning - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold text-white">Retirement Planning</h2>
  </div>

  <!-- Error Messages -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  <!-- Retirement Readiness Score -->
  {#if data.projection}
    <div class="grid gap-4 sm:grid-cols-4">
      <Card class="sm:col-span-1">
        <div class="flex flex-col items-center text-center">
          <p class="text-sm text-surface-400">Readiness Score</p>
          <div class="relative mt-3 h-28 w-28">
            <!-- Score circle background -->
            <svg class="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" stroke-width="8" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={data.projection.retirementReadinessScore >= 80
                  ? '#22c55e'
                  : data.projection.retirementReadinessScore >= 60
                    ? '#eab308'
                    : data.projection.retirementReadinessScore >= 40
                      ? '#f97316'
                      : '#ef4444'}
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray={`${data.projection.retirementReadinessScore * 2.64} 264`}
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span
                class="text-2xl font-bold {getScoreColor(data.projection.retirementReadinessScore)}"
              >
                {data.projection.retirementReadinessScore}
              </span>
            </div>
          </div>
          <p
            class="mt-2 text-sm font-medium {getScoreColor(
              data.projection.retirementReadinessScore,
            )}"
          >
            {getScoreLabel(data.projection.retirementReadinessScore)}
          </p>
        </div>
      </Card>

      <Card>
        <p class="text-sm text-surface-400">Projected Balance at Retirement</p>
        <p class="mt-1 text-xl font-bold text-white">
          {fmt(data.projection.projectedBalance.median)}
        </p>
        <p class="mt-1 text-xs text-surface-500">
          Range: {fmt(data.projection.projectedBalance.p10)} - {fmt(
            data.projection.projectedBalance.p90,
          )}
        </p>
      </Card>

      <Card>
        <p class="text-sm text-surface-400">Monthly Income at Retirement</p>
        <p class="mt-1 text-xl font-bold text-white">
          {fmt(data.projection.monthlyIncomeAtRetirement.median)}
        </p>
        <p class="mt-1 text-xs text-surface-500">
          Desired: {fmt(data.profile.desiredMonthlyIncome)}
        </p>
        {#if data.projection.shortfallAmount > 0}
          <p class="mt-1 text-xs text-red-400">
            Shortfall: {fmt(data.projection.shortfallAmount)}/mo
          </p>
        {:else}
          <p class="mt-1 text-xs text-green-400">On track to meet your goal</p>
        {/if}
      </Card>

      <Card>
        <p class="text-sm text-surface-400">Success Rate</p>
        <p class="mt-1 text-3xl font-bold {getSuccessColor(data.projection.successRate)}">
          {fmtPct(data.projection.successRate)}
        </p>
        <p class="mt-1 text-xs text-surface-500">Probability money lasts 30 years</p>
        {#if data.projection.yearsToRetirement > 0}
          <p class="mt-1 text-xs text-surface-500">
            {data.projection.yearsToRetirement} years to retirement
          </p>
        {/if}
      </Card>
    </div>

    <!-- Shortfall Alert -->
    {#if data.projection.shortfallAmount > 0}
      <div class="rounded-lg border border-orange-700/50 bg-orange-900/20 p-4">
        <div class="flex items-start gap-3">
          <svg
            class="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p class="font-medium text-orange-300">Projected Income Shortfall</p>
            <p class="mt-1 text-sm text-orange-300/80">
              Your projected monthly retirement income is {fmt(data.projection.shortfallAmount)} below
              your desired income. Consider increasing your monthly contribution to
              <span class="font-semibold text-orange-200"
                >{fmt(data.projection.recommendedContribution)}/mo</span
              >
              to close the gap.
            </p>
          </div>
        </div>
      </div>
    {/if}
  {/if}

  <!-- Projection Chart -->
  {#if data.projection && data.projection.yearByYear.length > 1}
    <Card>
      <h3 class="mb-4 text-lg font-semibold text-white">Balance Projection (Confidence Bands)</h3>
      <LineChart labels={projectionLabels} datasets={projectionDatasets} height={350} />
    </Card>
  {/if}

  <!-- Income Sources at Retirement -->
  {#if data.projection}
    <Card>
      <h3 class="mb-4 text-lg font-semibold text-white">Monthly Income Sources at Retirement</h3>
      <BarChart labels={incomeLabels} datasets={incomeDatasets} height={250} stacked={false} />
    </Card>
  {/if}

  <!-- Profile Section (Collapsible) -->
  <Card padding="none">
    <button
      class="flex w-full items-center justify-between p-6"
      onclick={() => (profileOpen = !profileOpen)}
    >
      <h3 class="text-lg font-semibold text-white">Retirement Profile</h3>
      <svg
        class="h-5 w-5 text-surface-400 transition-transform {profileOpen ? 'rotate-180' : ''}"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if profileOpen}
      <div class="border-t border-surface-700 p-6">
        <form
          method="POST"
          action="?/updateProfile"
          use:enhance={() => {
            loading = true;
            return async ({ update }) => {
              await update();
            };
          }}
          class="space-y-6"
        >
          <!-- Age Controls -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="currentAge" class="block text-sm font-medium text-surface-300">
                Current Age: <span class="text-white">{data.profile.currentAge}</span>
              </label>
              <input
                id="currentAge"
                name="currentAge"
                type="range"
                min="18"
                max="80"
                value={data.profile.currentAge}
                class="mt-2 w-full accent-primary-500"
              />
              <div class="flex justify-between text-xs text-surface-500">
                <span>18</span>
                <span>80</span>
              </div>
            </div>
            <div>
              <label for="retirementAge" class="block text-sm font-medium text-surface-300">
                Retirement Age: <span class="text-white">{data.profile.retirementAge}</span>
              </label>
              <input
                id="retirementAge"
                name="retirementAge"
                type="range"
                min="50"
                max="80"
                value={data.profile.retirementAge}
                class="mt-2 w-full accent-primary-500"
              />
              <div class="flex justify-between text-xs text-surface-500">
                <span>50</span>
                <span>80</span>
              </div>
            </div>
          </div>

          <!-- Savings & Contributions -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="currentSavings" class="block text-sm font-medium text-surface-300">
                Current Retirement Savings
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="currentSavings"
                  name="currentSavings"
                  type="number"
                  step="100"
                  min="0"
                  value={data.profile.currentSavings}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label for="monthlyContribution" class="block text-sm font-medium text-surface-300">
                Monthly Contribution
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="monthlyContribution"
                  name="monthlyContribution"
                  type="number"
                  step="50"
                  min="0"
                  value={data.profile.monthlyContribution}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <!-- Employer Match & Risk -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="employerMatch" class="block text-sm font-medium text-surface-300">
                Employer Match (%)
              </label>
              <div class="relative mt-1">
                <input
                  id="employerMatch"
                  name="employerMatch"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={data.profile.employerMatch}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span class="absolute right-3 top-2.5 text-surface-400">%</span>
              </div>
            </div>
            <div>
              <label for="riskTolerance" class="block text-sm font-medium text-surface-300">
                Risk Tolerance
              </label>
              <select
                id="riskTolerance"
                name="riskTolerance"
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option
                  value="conservative"
                  selected={data.profile.riskTolerance === 'conservative'}
                >
                  Conservative (6% avg return, lower volatility)
                </option>
                <option value="moderate" selected={data.profile.riskTolerance === 'moderate'}>
                  Moderate (8% avg return, medium volatility)
                </option>
                <option value="aggressive" selected={data.profile.riskTolerance === 'aggressive'}>
                  Aggressive (10% avg return, higher volatility)
                </option>
              </select>
            </div>
          </div>

          <!-- Income Goals -->
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label for="desiredMonthlyIncome" class="block text-sm font-medium text-surface-300">
                Desired Monthly Income
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="desiredMonthlyIncome"
                  name="desiredMonthlyIncome"
                  type="number"
                  step="100"
                  min="0"
                  value={data.profile.desiredMonthlyIncome}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label
                for="socialSecurityEstimate"
                class="block text-sm font-medium text-surface-300"
              >
                Social Security (monthly)
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="socialSecurityEstimate"
                  name="socialSecurityEstimate"
                  type="number"
                  step="100"
                  min="0"
                  value={data.profile.socialSecurityEstimate}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label for="pensionAmount" class="block text-sm font-medium text-surface-300">
                Pension (monthly)
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="pensionAmount"
                  name="pensionAmount"
                  type="number"
                  step="100"
                  min="0"
                  value={data.profile.pensionAmount}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <!-- Inflation Rate -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="inflationRate" class="block text-sm font-medium text-surface-300">
                Expected Inflation Rate (%)
              </label>
              <div class="relative mt-1">
                <input
                  id="inflationRate"
                  name="inflationRate"
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  value={data.profile.inflationRate}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span class="absolute right-3 top-2.5 text-surface-400">%</span>
              </div>
            </div>
            <div>
              <label for="expectedReturn" class="block text-sm font-medium text-surface-300">
                Expected Annual Return (%)
              </label>
              <div class="relative mt-1">
                <input
                  id="expectedReturn"
                  name="expectedReturn"
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={data.profile.expectedReturn}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span class="absolute right-3 top-2.5 text-surface-400">%</span>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <Button type="submit" {loading}>Update & Recalculate</Button>
          </div>
        </form>
      </div>
    {/if}
  </Card>

  <!-- Scenario Comparison Section -->
  <Card padding="none">
    <button
      class="flex w-full items-center justify-between p-6"
      onclick={() => (scenariosOpen = !scenariosOpen)}
    >
      <h3 class="text-lg font-semibold text-white">Scenario Comparison</h3>
      <svg
        class="h-5 w-5 text-surface-400 transition-transform {scenariosOpen ? 'rotate-180' : ''}"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if scenariosOpen}
      <div class="border-t border-surface-700 p-6">
        <p class="mb-4 text-sm text-surface-400">
          Compare different retirement scenarios by adjusting retirement age or contribution
          amounts.
        </p>

        <!-- Scenarios List -->
        <div class="space-y-4">
          {#each scenarios as scenario, i}
            <div class="rounded-lg border border-surface-700 p-4">
              <div class="flex items-center justify-between">
                <input
                  type="text"
                  bind:value={scenario.label}
                  class="bg-transparent text-sm font-medium text-white focus:outline-none"
                  placeholder="Scenario name"
                />
                <button
                  aria-label="Remove scenario"
                  class="text-surface-400 hover:text-red-400"
                  onclick={() => removeScenario(i)}
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label for="retirement-age-{i}" class="block text-xs text-surface-500"
                    >Retirement Age</label
                  >
                  <input
                    id="retirement-age-{i}"
                    type="number"
                    min="50"
                    max="80"
                    bind:value={scenario.retirementAge}
                    class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label for="monthly-contribution-{i}" class="block text-xs text-surface-500"
                    >Monthly Contribution</label
                  >
                  <input
                    id="monthly-contribution-{i}"
                    type="number"
                    min="0"
                    step="50"
                    bind:value={scenario.monthlyContribution}
                    class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="mt-4 flex gap-3">
          <Button variant="secondary" size="sm" onclick={addScenario}>Add Scenario</Button>

          {#if scenarios.length > 0}
            <form
              method="POST"
              action="?/compareScenarios"
              use:enhance={() => {
                loading = true;
                return async ({ update }) => {
                  await update();
                };
              }}
            >
              <input type="hidden" name="scenarios" value={JSON.stringify(scenarios)} />
              <Button type="submit" size="sm" {loading}>Compare</Button>
            </form>
          {/if}
        </div>

        <!-- Scenario Results -->
        {#if scenarioResults && scenarioResults.length > 0}
          <div class="mt-6">
            <h4 class="mb-3 text-sm font-medium text-surface-300">Comparison Results</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-surface-700">
                    <th class="px-4 py-2 text-left text-surface-400">Scenario</th>
                    <th class="px-4 py-2 text-right text-surface-400">Projected Balance</th>
                    <th class="px-4 py-2 text-right text-surface-400">Monthly Income</th>
                    <th class="px-4 py-2 text-right text-surface-400">Success Rate</th>
                    <th class="px-4 py-2 text-right text-surface-400">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {#each scenarioResults as result}
                    <tr class="border-b border-surface-700/50">
                      <td class="px-4 py-2 font-medium text-white">{result.label}</td>
                      <td class="px-4 py-2 text-right text-surface-300"
                        >{fmt(result.projectedBalance)}</td
                      >
                      <td class="px-4 py-2 text-right text-surface-300"
                        >{fmt(result.monthlyIncome)}</td
                      >
                      <td class="px-4 py-2 text-right {getSuccessColor(result.successRate)}">
                        {fmtPct(result.successRate)}
                      </td>
                      <td class="px-4 py-2 text-right">
                        <span
                          class="inline-flex items-center gap-1.5 {getScoreColor(
                            result.readinessScore,
                          )}"
                        >
                          {result.readinessScore}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Comparison chart -->
            {#if scenarioResults.length > 1}
              <div class="mt-4">
                <BarChart
                  labels={scenarioResults.map((r: any) => r.label)}
                  datasets={[
                    {
                      label: 'Projected Balance',
                      data: scenarioResults.map((r: any) => r.projectedBalance),
                      backgroundColor: '#3b82f6',
                    },
                  ]}
                  height={200}
                />
              </div>
            {/if}
          </div>
        {/if}

        {#if form?.scenarioError}
          <div class="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">
            {form.scenarioError}
          </div>
        {/if}
      </div>
    {/if}
  </Card>

  <!-- 401(k) Fee Analyzer Section -->
  <Card padding="none">
    <button
      class="flex w-full items-center justify-between p-6"
      onclick={() => (feeAnalyzerOpen = !feeAnalyzerOpen)}
    >
      <h3 class="text-lg font-semibold text-white">401(k) Fee Analyzer</h3>
      <svg
        class="h-5 w-5 text-surface-400 transition-transform {feeAnalyzerOpen ? 'rotate-180' : ''}"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {#if feeAnalyzerOpen}
      <div class="border-t border-surface-700 p-6">
        <p class="mb-4 text-sm text-surface-400">
          See how 401(k) fees impact your retirement savings over time.
        </p>

        <form
          method="POST"
          action="?/analyzeFees"
          use:enhance={() => {
            loading = true;
            return async ({ update }) => {
              await update();
            };
          }}
          class="space-y-4"
        >
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label for="feeBalance" class="block text-sm font-medium text-surface-300">
                Current 401(k) Balance
              </label>
              <div class="relative mt-1">
                <span class="absolute left-3 top-2.5 text-surface-400">$</span>
                <input
                  id="feeBalance"
                  name="currentBalance"
                  type="number"
                  step="1000"
                  min="0"
                  value={data.profile.currentSavings || 100000}
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 py-2 pl-8 pr-3 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label for="feePercent" class="block text-sm font-medium text-surface-300">
                Annual Fee (%)
              </label>
              <div class="relative mt-1">
                <input
                  id="feePercent"
                  name="annualFeePercent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value="1.0"
                  class="block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span class="absolute right-3 top-2.5 text-surface-400">%</span>
              </div>
            </div>
            <div>
              <label for="feeYears" class="block text-sm font-medium text-surface-300">
                Years to Retirement
              </label>
              <input
                id="feeYears"
                name="yearsToRetirement"
                type="number"
                min="1"
                max="50"
                value={data.projection?.yearsToRetirement ?? 35}
                class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <Button type="submit" size="sm" {loading}>Analyze Fees</Button>
        </form>

        {#if form?.feeError}
          <div class="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.feeError}</div>
        {/if}

        {#if feeAnalysis}
          <div class="mt-6 space-y-4">
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="rounded-lg bg-surface-900 p-4">
                <p class="text-xs text-surface-500">Total Fees Paid</p>
                <p class="mt-1 text-lg font-bold text-red-400">{fmt(feeAnalysis.totalFeesPaid)}</p>
              </div>
              <div class="rounded-lg bg-surface-900 p-4">
                <p class="text-xs text-surface-500">Balance With Current Fees</p>
                <p class="mt-1 text-lg font-bold text-white">{fmt(feeAnalysis.balanceWithFees)}</p>
              </div>
              <div class="rounded-lg bg-surface-900 p-4">
                <p class="text-xs text-surface-500">Balance If No Fees</p>
                <p class="mt-1 text-lg font-bold text-green-400">
                  {fmt(feeAnalysis.balanceWithoutFees)}
                </p>
              </div>
            </div>

            <div class="rounded-lg border border-surface-700 bg-surface-900/50 p-4">
              <div class="flex items-start gap-3">
                <svg
                  class="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p class="text-sm font-medium text-surface-200">Fee Impact Analysis</p>
                  <p class="mt-1 text-sm text-surface-400">
                    Fees cost you <span class="font-semibold text-red-400"
                      >{fmt(feeAnalysis.balanceImpact)}</span
                    >
                    over your career. Switching to a low-cost index fund at {feeAnalysis.lowFeePercent}%
                    would give you
                    <span class="font-semibold text-green-400"
                      >{fmt(feeAnalysis.feeOptimizedBalance)}</span
                    >
                    at retirement -- that is
                    <span class="font-semibold text-green-400"
                      >{fmt(feeAnalysis.feeOptimizedBalance - feeAnalysis.balanceWithFees)}</span
                    > more than your current plan.
                  </p>
                </div>
              </div>
            </div>

            <!-- Fee comparison bar chart -->
            <BarChart
              labels={['Current Fees', 'Low-Cost Fund', 'No Fees']}
              datasets={[
                {
                  label: 'Retirement Balance',
                  data: [
                    feeAnalysis.balanceWithFees,
                    feeAnalysis.feeOptimizedBalance,
                    feeAnalysis.balanceWithoutFees,
                  ],
                  backgroundColor: '#3b82f6',
                },
              ]}
              height={200}
            />
          </div>
        {/if}
      </div>
    {/if}
  </Card>

  <!-- Year-by-year Breakdown Table -->
  {#if data.projection && data.projection.yearByYear.length > 1}
    <Card>
      <h3 class="mb-4 text-lg font-semibold text-white">Year-by-Year Projection</h3>
      <div class="max-h-96 overflow-y-auto overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-surface-800">
            <tr class="border-b border-surface-700">
              <th class="px-4 py-2 text-left text-surface-400">Age</th>
              <th class="px-4 py-2 text-right text-surface-400">Balance (Median)</th>
              <th class="px-4 py-2 text-right text-surface-400">Low (10th)</th>
              <th class="px-4 py-2 text-right text-surface-400">High (90th)</th>
              <th class="px-4 py-2 text-right text-surface-400">Contributions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.projection.yearByYear as row}
              <tr class="border-b border-surface-700/50">
                <td class="px-4 py-2 font-medium text-surface-300">
                  {row.age}
                  {#if row.age === data.profile.retirementAge}
                    <span class="ml-1 text-xs text-primary-400">(retire)</span>
                  {/if}
                </td>
                <td class="px-4 py-2 text-right font-medium text-white">{fmt(row.balanceMedian)}</td
                >
                <td class="px-4 py-2 text-right text-orange-400">{fmt(row.balanceLow)}</td>
                <td class="px-4 py-2 text-right text-green-400">{fmt(row.balanceHigh)}</td>
                <td class="px-4 py-2 text-right text-surface-400">{fmt(row.contributions)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>
