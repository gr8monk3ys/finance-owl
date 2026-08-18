<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { Card, Button } from '$components/ui';
  import BillCalendar from '$lib/components/bills/BillCalendar.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let viewMode = $state<'timeline' | 'list' | 'calendar'>('timeline');
  let reminderDays = $state(3);

  $effect(() => {
    if (form?.success) {
      invalidateAll();
    }
  });

  function fmt(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const todayStr = $derived(new Date().toISOString().split('T')[0]);

  function daysUntil(dateStr: string): number {
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date(todayStr + 'T00:00:00');
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Summary calculations
  const now = new Date();
  const weekEndStr = $derived.by(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const monthStartStr = $derived(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
  );

  const monthEndStr = $derived(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  );

  const billsDueThisWeek = $derived(
    data.upcoming.filter((b: any) => b.expectedDate >= todayStr && b.expectedDate <= weekEndStr),
  );

  const billsDueThisMonth = $derived(
    data.upcoming.filter(
      (b: any) => b.expectedDate >= monthStartStr && b.expectedDate <= monthEndStr,
    ),
  );

  const monthlyTotal = $derived(
    billsDueThisMonth.reduce((sum: number, b: any) => sum + b.estimatedAmount, 0),
  );

  const weeklyTotal = $derived(
    billsDueThisWeek.reduce((sum: number, b: any) => sum + b.estimatedAmount, 0),
  );

  const nextBill = $derived.by(() => {
    const future = data.upcoming.filter((b: any) => b.expectedDate >= todayStr);
    if (future.length === 0) return null;
    return future.reduce((closest: any, b: any) =>
      b.expectedDate < closest.expectedDate ? b : closest,
    );
  });

  // Overdue / upcoming / reminder bills
  const overdueBills = $derived(
    data.upcoming.filter((b: any) => b.expectedDate < todayStr && !b.paid),
  );

  const futureBills = $derived(
    data.upcoming
      .filter((b: any) => b.expectedDate >= todayStr)
      .sort((a: any, b: any) => a.expectedDate.localeCompare(b.expectedDate)),
  );

  const reminderBills = $derived(
    futureBills.filter((b: any) => {
      const days = daysUntil(b.expectedDate);
      return days >= 0 && days <= reminderDays;
    }),
  );

  const monthLabel = $derived(now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  // Timeline: group by week
  const timelineWeeks = $derived.by(() => {
    const weeks: { label: string; startDate: string; bills: any[] }[] = [];
    const today = new Date(todayStr + 'T00:00:00');

    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];

      const weekBills = futureBills.filter(
        (b: any) => b.expectedDate >= startStr && b.expectedDate <= endStr,
      );

      if (weekBills.length > 0) {
        const label =
          w === 0
            ? 'This Week'
            : w === 1
              ? 'Next Week'
              : `${formatShortDate(startStr)} - ${formatShortDate(endStr)}`;

        weeks.push({ label, startDate: startStr, bills: weekBills });
      }
    }

    return weeks;
  });
</script>

<svelte:head>
  <title>Bills - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header with view toggle -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-2xl font-bold text-white">Bills</h2>
      <p class="mt-1 text-sm text-surface-400">Track upcoming payments and never miss a due date</p>
    </div>
    <div class="flex items-center gap-2">
      <div class="flex rounded-lg bg-surface-800 p-0.5">
        {#each [{ id: 'timeline' as const, label: 'Timeline', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }, { id: 'list' as const, label: 'List', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' }, { id: 'calendar' as const, label: 'Calendar', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' }] as mode}
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition {viewMode === mode.id
              ? 'bg-surface-700 text-white'
              : 'text-surface-400 hover:text-white'}"
            onclick={() => (viewMode = mode.id)}
          >
            <svg
              class="mr-1 inline-block h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d={mode.icon} />
            </svg>
            {mode.label}
          </button>
        {/each}
      </div>
      <a href="/subscriptions" class="text-sm text-emerald-400 hover:text-emerald-300">
        Manage Subscriptions
      </a>
    </div>
  </div>

  <!-- Error -->
  {#if form?.error}
    <div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
  {/if}

  <!-- Summary strip -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
      <p class="text-sm text-surface-400">Due This Week</p>
      <p class="mt-1 text-xl font-bold text-white">{fmt(weeklyTotal)}</p>
      <p class="mt-1 text-xs text-surface-500">
        {billsDueThisWeek.length} bill{billsDueThisWeek.length !== 1 ? 's' : ''}
      </p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Due This Month</p>
      <p class="mt-1 text-xl font-bold text-white">{fmt(monthlyTotal)}</p>
      <p class="mt-1 text-xs text-surface-500">
        {billsDueThisMonth.length} bill{billsDueThisMonth.length !== 1 ? 's' : ''} in {monthLabel}
      </p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Monthly Total</p>
      <p class="mt-1 text-xl font-bold text-red-400">-{fmt(monthlyTotal)}</p>
      <p class="mt-1 text-xs text-surface-500">Expected outflows</p>
    </Card>
    <Card>
      <p class="text-sm text-surface-400">Next Bill Due</p>
      {#if nextBill}
        {@const days = daysUntil(nextBill.expectedDate)}
        <p class="mt-1 text-xl font-bold text-white">{fmt(nextBill.estimatedAmount)}</p>
        <p class="mt-1 text-xs text-surface-500">
          {nextBill.merchantName || nextBill.name}
          {#if days === 0}
            - <span class="text-amber-400">today</span>
          {:else if days === 1}
            - <span class="text-amber-400">tomorrow</span>
          {:else}
            - in {days} days
          {/if}
        </p>
      {:else}
        <p class="mt-1 text-xl font-bold text-white">--</p>
        <p class="mt-1 text-xs text-surface-500">No upcoming bills</p>
      {/if}
    </Card>
  </div>

  <!-- Bill reminders alert -->
  {#if reminderBills.length > 0}
    <Card>
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-600/20"
        >
          <svg
            class="h-5 w-5 text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div class="flex-1">
          <p class="font-medium text-amber-400">
            {reminderBills.length} bill{reminderBills.length !== 1 ? 's' : ''} due within {reminderDays}
            days
          </p>
          <p class="text-sm text-surface-400">
            Total: {fmt(reminderBills.reduce((s: number, b: any) => s + b.estimatedAmount, 0))}
            - {reminderBills.map((b: any) => b.merchantName || b.name).join(', ')}
          </p>
        </div>
        <select
          bind:value={reminderDays}
          class="rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-xs text-white"
        >
          <option value={1}>1 day</option>
          <option value={3}>3 days</option>
          <option value={7}>7 days</option>
        </select>
      </div>
    </Card>
  {/if}

  <!-- View content -->
  {#if viewMode === 'calendar'}
    <!-- Calendar View -->
    <Card padding="sm">
      <BillCalendar bills={data.upcoming} />
    </Card>
  {:else if viewMode === 'timeline'}
    <!-- Timeline View -->

    <!-- Overdue bills -->
    {#if overdueBills.length > 0}
      <Card>
        <div class="flex items-center gap-2">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/20">
            <svg class="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-red-400">
            Overdue ({overdueBills.length})
          </h3>
          <span class="ml-auto text-sm font-medium text-red-400">
            {fmt(overdueBills.reduce((s: number, b: any) => s + b.estimatedAmount, 0))}
          </span>
        </div>
        <div class="mt-3 space-y-2">
          {#each overdueBills as bill}
            <div class="flex items-center justify-between rounded-lg bg-red-950/30 p-3">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/20">
                  <span class="text-sm font-bold text-red-400">!</span>
                </div>
                <div>
                  <p class="text-sm font-medium text-white">
                    {bill.merchantName || bill.name}
                  </p>
                  <p class="text-xs text-red-400">
                    {Math.abs(daysUntil(bill.expectedDate))} days overdue - was due {formatDate(
                      bill.expectedDate,
                    )}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm font-semibold text-white">
                  {fmt(bill.estimatedAmount)}
                </span>
                {#if bill.id}
                  <form method="POST" action="?/markPaid" use:enhance>
                    <input type="hidden" name="id" value={bill.id} />
                    <Button type="submit" size="sm" variant="secondary">Mark Paid</Button>
                  </form>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- Timeline weeks -->
    {#if timelineWeeks.length > 0}
      <div class="space-y-4">
        {#each timelineWeeks as week, wi}
          <div
            class="transform transition-all duration-300"
            style="animation: slideInUp 0.3s ease-out {wi * 0.1}s both"
          >
            <Card>
              <div class="mb-3 flex items-center justify-between">
                <h3 class="text-lg font-semibold text-white">{week.label}</h3>
                <span class="text-sm font-medium text-emerald-400">
                  {fmt(week.bills.reduce((s: number, b: any) => s + b.estimatedAmount, 0))}
                </span>
              </div>
              <div class="relative border-l-2 border-surface-700 pl-6">
                {#each week.bills as bill, bi}
                  {@const days = daysUntil(bill.expectedDate)}
                  <div class="relative mb-4 last:mb-0">
                    <!-- Timeline dot -->
                    <div
                      class="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 {days === 0
                        ? 'border-amber-400 bg-amber-400'
                        : days <= 1
                          ? 'border-amber-400 bg-surface-900'
                          : 'border-surface-500 bg-surface-900'}"
                    ></div>

                    <div class="flex items-center justify-between rounded-lg bg-surface-800/50 p-3">
                      <div class="flex items-center gap-3">
                        {#if bill.categoryColor}
                          <span
                            class="h-2.5 w-2.5 rounded-full"
                            style="background-color: {bill.categoryColor}"
                          ></span>
                        {/if}
                        <div>
                          <p class="text-sm font-medium text-white">
                            {bill.merchantName || bill.name}
                          </p>
                          <p class="text-xs text-surface-500">
                            {formatDate(bill.expectedDate)}
                            {#if days === 0}
                              - <span class="text-amber-400">Due today</span>
                            {:else if days === 1}
                              - <span class="text-amber-400">Due tomorrow</span>
                            {:else if days <= 7}
                              - <span class="text-amber-400">in {days} days</span>
                            {:else}
                              - in {days} days
                            {/if}
                          </p>
                        </div>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="text-sm font-semibold text-white">
                          {fmt(bill.estimatedAmount)}
                        </span>
                        {#if bill.id}
                          <form method="POST" action="?/markPaid" use:enhance>
                            <input type="hidden" name="id" value={bill.id} />
                            <button
                              type="submit"
                              class="rounded p-1 text-surface-400 transition hover:bg-surface-700 hover:text-emerald-400"
                              title="Mark as paid"
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
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </button>
                          </form>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            </Card>
          </div>
        {/each}
      </div>
    {:else if overdueBills.length === 0}
      <Card>
        <div class="flex flex-col items-center justify-center py-8 text-center">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p class="mt-3 text-surface-300">No upcoming bills</p>
          <a href="/subscriptions" class="mt-1 text-sm text-emerald-400 hover:text-emerald-300">
            Manage subscriptions
          </a>
        </div>
      </Card>
    {/if}
  {:else}
    <!-- List View -->

    <!-- Overdue bills -->
    {#if overdueBills.length > 0}
      <Card>
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          <h3 class="text-lg font-semibold text-red-400">
            Overdue ({overdueBills.length})
          </h3>
        </div>
        <div class="mt-3 divide-y divide-surface-700">
          {#each overdueBills as bill}
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                {#if bill.categoryColor}
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    style="background-color: {bill.categoryColor}"
                  ></span>
                {/if}
                <div>
                  <p class="text-sm font-medium text-white">
                    {bill.merchantName || bill.name}
                  </p>
                  <p class="text-xs text-red-400">
                    {Math.abs(daysUntil(bill.expectedDate))} days overdue - was due {formatDate(
                      bill.expectedDate,
                    )}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm font-semibold text-white">
                  {fmt(bill.estimatedAmount)}
                </span>
                {#if bill.id}
                  <form method="POST" action="?/markPaid" use:enhance>
                    <input type="hidden" name="id" value={bill.id} />
                    <Button type="submit" size="sm" variant="secondary">Mark Paid</Button>
                  </form>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <!-- Upcoming bills -->
    {#if futureBills.length > 0}
      <Card>
        <h3 class="mb-3 text-lg font-semibold text-white">Upcoming Bills</h3>
        <div class="divide-y divide-surface-700">
          {#each futureBills as bill}
            {@const days = daysUntil(bill.expectedDate)}
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                {#if bill.categoryColor}
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    style="background-color: {bill.categoryColor}"
                  ></span>
                {/if}
                <div>
                  <p class="text-sm font-medium text-white">
                    {bill.merchantName || bill.name}
                  </p>
                  <p class="text-xs text-surface-500">
                    {formatDate(bill.expectedDate)}
                    {#if days === 0}
                      - <span class="text-amber-400">Due today</span>
                    {:else if days === 1}
                      - <span class="text-amber-400">Due tomorrow</span>
                    {:else if days <= 7}
                      - <span class="text-amber-400">in {days} days</span>
                    {:else}
                      - in {days} days
                    {/if}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm font-semibold text-white">
                  {fmt(bill.estimatedAmount)}
                </span>
                {#if bill.id}
                  <form method="POST" action="?/markPaid" use:enhance>
                    <input type="hidden" name="id" value={bill.id} />
                    <button
                      type="submit"
                      class="rounded p-1 text-surface-400 transition hover:bg-surface-700 hover:text-emerald-400"
                      title="Mark as paid"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </form>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {:else if overdueBills.length === 0}
      <Card>
        <div class="flex flex-col items-center justify-center py-8 text-center">
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p class="mt-3 text-surface-300">No upcoming bills</p>
          <a href="/subscriptions" class="mt-1 text-sm text-emerald-400 hover:text-emerald-300">
            Manage subscriptions
          </a>
        </div>
      </Card>
    {/if}

    <!-- Subscriptions list -->
    {#if data.subscriptions && data.subscriptions.length > 0}
      <Card>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-white">Active Subscriptions</h3>
          <a href="/subscriptions" class="text-sm text-emerald-400 hover:text-emerald-300">
            Manage
          </a>
        </div>
        <div class="mt-3 divide-y divide-surface-700">
          {#each data.subscriptions.slice(0, 10) as sub}
            <div class="flex items-center justify-between py-3">
              <div class="flex items-center gap-3">
                {#if sub.categoryColor}
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    style="background-color: {sub.categoryColor}"
                  ></span>
                {/if}
                <div>
                  <p class="text-sm font-medium text-white">
                    {sub.merchantName || sub.name}
                  </p>
                  <p class="text-xs text-surface-500">
                    {sub.frequency}
                    {#if sub.categoryName}
                      <span style="color: {sub.categoryColor}">
                        - {sub.categoryName}
                      </span>
                    {/if}
                  </p>
                </div>
              </div>
              <span class="text-sm font-semibold text-white">
                {fmt(sub.estimatedAmount)}
                <span class="text-xs text-surface-500">
                  /{sub.frequency === 'annual'
                    ? 'yr'
                    : sub.frequency === 'monthly'
                      ? 'mo'
                      : sub.frequency}
                </span>
              </span>
            </div>
          {/each}
        </div>
        {#if data.subscriptions.length > 10}
          <div class="mt-3 text-center">
            <a href="/subscriptions" class="text-sm text-emerald-400 hover:text-emerald-300">
              View all {data.subscriptions.length} subscriptions
            </a>
          </div>
        {/if}
      </Card>
    {/if}
  {/if}
</div>

<style>
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
