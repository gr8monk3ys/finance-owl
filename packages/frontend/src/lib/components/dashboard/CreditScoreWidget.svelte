<script lang="ts">
  import { Card } from '$components/ui';

  interface CreditScore {
    score: number;
    source: string;
    scoreType: string;
    reportDate: string;
  }

  interface Props {
    creditScore: CreditScore | null;
  }

  let { creditScore }: Props = $props();

  function getScoreColor(score: number): string {
    if (score >= 750) return '#22c55e';
    if (score >= 700) return '#84cc16';
    if (score >= 650) return '#f59e0b';
    if (score >= 600) return '#f97316';
    return '#ef4444';
  }

  function getScoreLabel(score: number): string {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    if (score >= 600) return 'Poor';
    return 'Very Poor';
  }

  const scoreColor = $derived(creditScore ? getScoreColor(creditScore.score) : '#64748b');
  const scoreLabel = $derived(creditScore ? getScoreLabel(creditScore.score) : '');
  const gaugePercent = $derived(creditScore ? ((creditScore.score - 300) / (850 - 300)) * 100 : 0);
</script>

<Card class="h-full">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-surface-400">Credit Score</h3>
    <a href="/credit" class="text-xs text-primary-400 hover:text-primary-300">Details</a>
  </div>

  {#if creditScore}
    <div class="mt-4 flex flex-col items-center">
      <!-- Gauge visualization -->
      <div class="relative h-20 w-36">
        <svg viewBox="0 0 120 60" class="h-full w-full">
          <!-- Background arc -->
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke="#334155"
            stroke-width="8"
            stroke-linecap="round"
          />
          <!-- Score arc -->
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke={scoreColor}
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray="{gaugePercent * 1.57} 157"
          />
        </svg>
        <div class="absolute inset-x-0 bottom-0 text-center">
          <span class="text-2xl font-bold text-white">{creditScore.score}</span>
        </div>
      </div>

      <span
        class="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
        style="background-color: {scoreColor}20; color: {scoreColor}"
      >
        {scoreLabel}
      </span>

      <p class="mt-2 text-xs text-surface-500">
        {creditScore.source} &middot;
        {new Date(creditScore.reportDate + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>
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
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
      <p class="mt-2 text-xs text-surface-500">
        <a href="/credit" class="text-primary-400 hover:text-primary-300">Add your credit score</a>
      </p>
    </div>
  {/if}
</Card>
