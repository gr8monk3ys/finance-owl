<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button, Modal } from '$components/ui';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let showApplyModal = $state(false);
  let copiedCode = $state(false);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
      showApplyModal = false;
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

  function copyReferralCode() {
    if (data.code?.code) {
      navigator.clipboard.writeText(data.code.code);
      copiedCode = true;
      setTimeout(() => (copiedCode = false), 2000);
    }
  }

  function shareViaEmail() {
    if (!data.code?.code) return;
    const subject = encodeURIComponent('Join Finance Owl with my referral code!');
    const body = encodeURIComponent(
      `Hey! I've been using Finance Owl to manage my finances and I think you'd love it too.\n\nUse my referral code: ${data.code.code}\n\nSign up at https://financeowl.com`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }

  function getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'rewarded':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      default:
        return 'bg-surface-600 text-surface-300 border border-surface-500/30';
    }
  }
</script>

<svelte:head>
  <title>Referral Program - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Referral Program</h2>
      <p class="mt-1 text-sm text-surface-400">
        Invite friends and earn rewards when they join Finance Owl.
      </p>
    </div>
    <Button variant="secondary" onclick={() => (showApplyModal = true)}>Apply a Code</Button>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  <!-- Referral Code Card -->
  <Card>
    <div
      class="flex flex-col items-center py-4 text-center sm:flex-row sm:justify-between sm:text-left"
    >
      <div>
        <p class="text-xs font-medium uppercase tracking-wider text-surface-400">
          Your Referral Code
        </p>
        {#if data.code?.code}
          <p class="mt-2 font-mono text-3xl font-bold tracking-widest text-white">
            {data.code.code}
          </p>
        {:else}
          <p class="mt-2 text-sm italic text-surface-500">Loading your code...</p>
        {/if}
      </div>
      <div class="mt-4 flex gap-2 sm:mt-0">
        <Button variant="secondary" onclick={copyReferralCode}>
          {#if copiedCode}
            <svg
              class="mr-1.5 h-4 w-4 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          {:else}
            <svg
              class="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy Code
          {/if}
        </Button>
        <Button variant="ghost" onclick={shareViaEmail}>
          <svg
            class="mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          Email
        </Button>
      </div>
    </div>
  </Card>

  <!-- Stats Cards -->
  <div class="grid gap-4 sm:grid-cols-4">
    <Card>
      <p class="text-sm text-surface-400">Total Referrals</p>
      <p class="mt-1 text-xl font-bold text-white">{data.stats.totalReferrals}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Total Earnings</p>
      <p class="mt-1 text-xl font-bold text-green-400">{fmt(data.stats.totalEarnings)}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Pending</p>
      <p class="mt-1 text-xl font-bold text-yellow-400">{data.stats.pendingReferrals}</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Completed</p>
      <p class="mt-1 text-xl font-bold text-primary-400">{data.stats.completedReferrals}</p>
    </Card>
  </div>

  <!-- Referral History -->
  <Card>
    <h3 class="text-lg font-semibold text-white">Referral History</h3>
    {#if data.referrals.length === 0}
      <div class="flex flex-col items-center py-8 text-center">
        <svg
          class="h-12 w-12 text-surface-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p class="mt-3 text-sm text-surface-400">
          No referrals yet. Share your code to get started!
        </p>
      </div>
    {:else}
      <div class="mt-4 divide-y divide-surface-700">
        {#each data.referrals as referral}
          <div class="flex items-center justify-between py-3">
            <div>
              <p class="text-sm text-white">Referral</p>
              <p class="text-xs text-surface-500">{fmtDate(referral.createdAt)}</p>
            </div>
            <div class="flex items-center gap-3">
              {#if referral.rewardAmount}
                <span class="text-sm font-medium text-green-400">
                  {fmt(referral.rewardAmount)}
                </span>
              {/if}
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize {getStatusBadgeColor(
                  referral.status,
                )}"
              >
                {referral.status}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Leaderboard -->
  {#if data.leaderboard.length > 0}
    <Card>
      <h3 class="text-lg font-semibold text-white">Referral Leaderboard</h3>
      <div class="mt-4 divide-y divide-surface-700">
        {#each data.leaderboard as entry, i}
          <div class="flex items-center justify-between py-3">
            <div class="flex items-center gap-3">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-surface-700 text-xs font-bold text-surface-300"
              >
                {i + 1}
              </span>
              <span class="font-mono text-sm text-surface-300">{entry.code}</span>
            </div>
            <div class="text-right">
              <p class="text-sm font-medium text-white">{entry.totalReferrals} referrals</p>
              <p class="text-xs text-surface-500">{fmt(entry.totalEarnings)} earned</p>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>

<!-- Apply Referral Code Modal -->
<Modal open={showApplyModal} onclose={() => (showApplyModal = false)} title="Apply Referral Code">
  <form
    method="POST"
    action="?/apply"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
      };
    }}
    class="space-y-4"
  >
    <div>
      <label for="referralCode" class="block text-sm font-medium text-surface-300">
        Referral Code
      </label>
      <input
        id="referralCode"
        name="code"
        type="text"
        required
        class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 font-mono tracking-wider text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="Enter referral code"
      />
      <p class="mt-1.5 text-xs text-surface-500">
        Enter a referral code from a friend to get started.
      </p>
    </div>

    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" type="button" onclick={() => (showApplyModal = false)}>Cancel</Button>
      <Button type="submit">Apply Code</Button>
    </div>
  </form>
</Modal>
