<script lang="ts">
  import { Card } from '$components/ui';

  const calculators = [
    {
      href: '/calculators/mortgage',
      name: 'Mortgage Calculator',
      description:
        'Estimate monthly payments, total interest, and view a full amortization schedule.',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      color: '#3b82f6',
    },
    {
      href: '/calculators/refinance',
      name: 'Refinance Calculator',
      description:
        'Compare your current loan with a refinance option and find the break-even point.',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      color: '#8b5cf6',
    },
    {
      href: '/calculators/amortization',
      name: 'Loan Amortization',
      description: 'See how extra payments reduce interest and shorten your loan payoff date.',
      icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      color: '#22c55e',
    },
    {
      href: '/calculators/savings',
      name: 'Savings / Compound Interest',
      description: 'Project how your savings will grow over time with compound interest.',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      color: '#f59e0b',
    },
    {
      href: '/calculators/dti',
      name: 'Debt-to-Income Ratio',
      description: 'Calculate your DTI ratio and see how lenders evaluate your borrowing capacity.',
      icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
      color: '#ef4444',
    },
    {
      href: '/calculators/net-worth',
      name: 'Net Worth Calculator',
      description: 'Add up your assets and liabilities to see your total net worth at a glance.',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: '#14b8a6',
    },
  ];
</script>

<svelte:head>
  <title>Financial Calculators - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold text-white">Financial Calculators</h2>
    <p class="mt-1 text-sm text-surface-400">
      Free tools to help you make smarter financial decisions.
    </p>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each calculators as calc}
      <a
        href={calc.href}
        class="group rounded-xl bg-surface-800 p-6 transition hover:bg-surface-700 hover:ring-1 hover:ring-primary-500/50"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
            style="background-color: {calc.color}20"
          >
            <svg
              class="h-6 w-6"
              style="color: {calc.color}"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d={calc.icon} />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-white group-hover:text-primary-400 transition">
              {calc.name}
            </p>
            <p class="mt-1 text-sm text-surface-400">{calc.description}</p>
          </div>
        </div>
        <div
          class="mt-4 flex items-center text-xs font-medium text-primary-400 opacity-0 transition group-hover:opacity-100"
        >
          Open calculator
          <svg
            class="ml-1 h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </a>
    {/each}
  </div>
</div>
